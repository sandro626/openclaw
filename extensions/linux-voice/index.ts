import type { Command } from "commander";
import { definePluginEntry, type OpenClawPluginApi } from "./api.js";
import { buildCaptureCandidates, buildPlaybackCommand } from "./src/audio.js";
import {
  DEFAULT_LINUX_VOICE_CONFIG,
  resolveLinuxVoiceConfig,
  type LinuxVoicePluginConfig,
} from "./src/config.js";
import { LinuxVoiceSession, loadVoiceWakeTriggers } from "./src/session.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
};

type RegisterCliContext = {
  program: Command;
  config: Record<string, unknown>;
  logger: Logger;
};

function createVoiceConfig(
  base: LinuxVoicePluginConfig,
  options: {
    agent?: string;
    sessionKey?: string;
    think?: string;
    noPlayback?: boolean;
  },
): LinuxVoicePluginConfig {
  const config: LinuxVoicePluginConfig = {
    ...base,
    ...(options.agent ? { agentId: options.agent.trim() } : {}),
    ...(options.sessionKey ? { sessionKey: options.sessionKey.trim() } : {}),
    conversation: {
      ...base.conversation,
      ...(options.think
        ? {
            thinkLevel: resolveLinuxVoiceConfig({
              conversation: { thinkLevel: options.think },
            }).conversation.thinkLevel,
          }
        : {}),
    },
    playback: {
      ...base.playback,
      ...(options.noPlayback ? { enabled: false } : {}),
    },
  };
  return config;
}

async function printDoctorInfo(params: {
  runtime: OpenClawPluginApi["runtime"];
  voiceConfig: LinuxVoicePluginConfig;
}): Promise<string> {
  const stateDir = params.runtime.state.resolveStateDir();
  const triggers = await loadVoiceWakeTriggers(stateDir);
  const captureCandidates = buildCaptureCandidates(params.voiceConfig).map((entry) => entry.label);
  const playback = buildPlaybackCommand({
    audioPath: "/tmp/example.mp3",
    config: params.voiceConfig,
  });
  return [
    "Linux voice doctor:",
    `- platform: ${process.platform}`,
    `- stateDir: ${stateDir}`,
    `- wakeWords: ${triggers.join(", ")}`,
    `- captureCandidates: ${captureCandidates.join(" | ")}`,
    `- playbackCommand: ${playback.command} ${playback.args.join(" ")}`,
    `- sessionKey: ${params.voiceConfig.sessionKey}`,
    `- agentId: ${params.voiceConfig.agentId}`,
    `- playback: ${params.voiceConfig.playback.enabled ? "enabled" : "disabled"}`,
  ].join("\n");
}

function registerLinuxVoiceCli(params: {
  program: Command;
  api: OpenClawPluginApi;
  voiceConfig: LinuxVoicePluginConfig;
}) {
  const root = params.program
    .command("voice")
    .description("Linux terminal voice wake and spoken OpenClaw interaction");

  root
    .command("start")
    .description("Start the foreground Linux voice session")
    .option("--agent <id>", "Agent id", params.voiceConfig.agentId)
    .option("--session-key <key>", "Session key", params.voiceConfig.sessionKey)
    .option(
      "--think <level>",
      "Thinking level (off|minimal|low|medium|high|xhigh|adaptive)",
      params.voiceConfig.conversation.thinkLevel,
    )
    .option("--no-playback", "Disable spoken playback and print replies only")
    .action(
      async (options: {
        agent?: string;
        sessionKey?: string;
        think?: string;
        noPlayback?: boolean;
      }) => {
        const effectiveConfig = createVoiceConfig(params.voiceConfig, options);
        if (!effectiveConfig.enabled) {
          throw new Error("linux-voice is disabled in plugin config.");
        }
        const session = new LinuxVoiceSession({
          runtime: params.api.runtime,
          config: params.api.config,
          voiceConfig: effectiveConfig,
          logger: params.api.logger,
        });
        let shuttingDown = false;
        const shutdown = async () => {
          shuttingDown = true;
          await session.stop().catch(() => {});
        };
        process.once("SIGINT", () => {
          void shutdown();
        });
        process.once("SIGTERM", () => {
          void shutdown();
        });
        try {
          await session.start();
        } catch (error) {
          if (
            shuttingDown &&
            error instanceof Error &&
            error.message.includes("voice capture stopped")
          ) {
            return;
          }
          throw error;
        }
      },
    );

  root
    .command("doctor")
    .description("Show Linux voice runtime wiring and wake-word state")
    .action(async () => {
      process.stdout.write(
        `${await printDoctorInfo({ runtime: params.api.runtime, voiceConfig: params.voiceConfig })}\n`,
      );
    });
}

export default definePluginEntry({
  id: "linux-voice",
  name: "Linux Voice",
  description: "Linux terminal voice wake and spoken OpenClaw interaction",
  register(api: OpenClawPluginApi) {
    const voiceConfig = resolveLinuxVoiceConfig(api.pluginConfig ?? DEFAULT_LINUX_VOICE_CONFIG);
    api.registerCli(
      ({ program }: RegisterCliContext) => {
        registerLinuxVoiceCli({
          program,
          api,
          voiceConfig,
        });
      },
      { commands: ["voice"] },
    );
  },
});
