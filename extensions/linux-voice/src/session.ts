import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawConfig, PluginRuntime } from "../api.js";
import { ContinuousVoiceCapture, playAudioFile } from "./audio.js";
import type { LinuxVoicePluginConfig } from "./config.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
};

type TranscriptAction =
  | { kind: "ignore" }
  | { kind: "ack"; trigger: string }
  | { kind: "prompt"; trigger?: string; prompt: string }
  | { kind: "disarm" };

type SessionStoreEntry = {
  sessionId: string;
  updatedAt: number;
  sessionFile?: string;
};

const DEFAULT_TRIGGERS = ["openclaw", "claude", "computer"];
const VOICE_PREFIX =
  "User spoke through Linux terminal voice mode. The transcript may contain recognition mistakes.";

function stripSimpleMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_~>#-]+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTranscript(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s,，。.!?！？:：-]+/, "")
    .replace(/[\s,，。.!?！？:：-]+$/, "")
    .trim()
    .toLowerCase();
}

function normalizeSpokenText(value: string): string | null {
  const stripped = stripSimpleMarkdown(value)
    .replace(/\s+/g, " ")
    .replace(/^[\s,，。.!?！？:：-]+/, "")
    .trim();
  return stripped.length > 0 ? stripped : null;
}

export function extractWakeRequest(
  transcript: string,
  triggers: string[],
): { trigger?: string; prompt?: string } {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return {};
  }
  const ordered = [...triggers]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((left, right) => right.length - left.length);
  for (const trigger of ordered) {
    const pattern = new RegExp(
      `(^|[\\s,，。.!?！？:：-])${escapeRegExp(trigger)}(?=$|[\\s,，。.!?！？:：-])`,
      "iu",
    );
    const match = pattern.exec(trimmed);
    if (!match) {
      continue;
    }
    const after = trimmed
      .slice(match.index + match[0].length)
      .replace(/^[\s,，。.!?！？:：-]+/, "")
      .trim();
    return {
      trigger,
      ...(after ? { prompt: after } : {}),
    };
  }
  return {};
}

export function decideTranscriptAction(params: {
  transcript: string;
  triggers: string[];
  stopPhrases: string[];
  conversationActive: boolean;
}): TranscriptAction {
  const normalized = normalizeTranscript(params.transcript);
  if (!normalized) {
    return { kind: "ignore" };
  }
  if (
    params.conversationActive &&
    params.stopPhrases.some((phrase) => normalizeTranscript(phrase) === normalized)
  ) {
    return { kind: "disarm" };
  }

  const wake = extractWakeRequest(params.transcript, params.triggers);
  if (params.conversationActive) {
    if (wake.prompt) {
      return { kind: "prompt", trigger: wake.trigger, prompt: wake.prompt };
    }
    if (wake.trigger) {
      return { kind: "ack", trigger: wake.trigger };
    }
    return { kind: "prompt", prompt: params.transcript.trim() };
  }

  if (!wake.trigger) {
    return { kind: "ignore" };
  }
  if (!wake.prompt) {
    return { kind: "ack", trigger: wake.trigger };
  }
  return { kind: "prompt", trigger: wake.trigger, prompt: wake.prompt };
}

export async function loadVoiceWakeTriggers(stateDir: string): Promise<string[]> {
  const filePath = path.join(stateDir, "settings", "voicewake.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { triggers?: unknown };
    const triggers = Array.isArray(parsed.triggers)
      ? parsed.triggers
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
      : [];
    return triggers.length > 0 ? triggers : [...DEFAULT_TRIGGERS];
  } catch {
    return [...DEFAULT_TRIGGERS];
  }
}

function buildWavBuffer(params: { pcm: Buffer; sampleRate: number; channels: number }): Buffer {
  const blockAlign = params.channels * 2;
  const byteRate = params.sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + params.pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(params.channels, 22);
  header.writeUInt32LE(params.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(params.pcm.length, 40);
  return Buffer.concat([header, params.pcm]);
}

async function writeTempWav(params: {
  pcm: Buffer;
  sampleRate: number;
  channels: number;
}): Promise<{ dir: string; filePath: string }> {
  const tempRoot = path.join(os.tmpdir(), "openclaw");
  await fs.mkdir(tempRoot, { recursive: true });
  const dir = await fs.mkdtemp(path.join(tempRoot, "linux-voice-"));
  const filePath = path.join(dir, `utterance-${crypto.randomUUID()}.wav`);
  await fs.writeFile(
    filePath,
    buildWavBuffer({
      pcm: params.pcm,
      sampleRate: params.sampleRate,
      channels: params.channels,
    }),
  );
  return { dir, filePath };
}

async function preserveDebugUtterance(params: {
  stateDir: string;
  filePath: string;
  durationMs: number;
  reason: string;
}): Promise<string> {
  const debugDir = path.join(params.stateDir, "cache", "linux-voice-debug");
  await fs.mkdir(debugDir, { recursive: true });
  const safeReason = params.reason.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  const targetPath = path.join(debugDir, `${Date.now()}-${params.durationMs}ms-${safeReason}.wav`);
  await fs.copyFile(params.filePath, targetPath);
  return targetPath;
}

async function runCommand(params: { command: string; args: string[] }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${params.command} exited with code ${code}`));
    });
  });
}

async function prepareRetryTranscriptionAudio(params: {
  filePath: string;
  sampleRate: number;
  channels: number;
}): Promise<string | null> {
  const parsed = path.parse(params.filePath);
  const retryPath = path.join(parsed.dir, `${parsed.name}.retry${parsed.ext || ".wav"}`);
  try {
    await runCommand({
      command: "ffmpeg",
      args: [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        params.filePath,
        "-af",
        [
          "volume=12dB",
          "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.1",
          "stop_periods=-1:stop_threshold=-42dB:stop_silence=0.25",
        ].join(","),
        "-ar",
        String(params.sampleRate),
        "-ac",
        String(params.channels),
        retryPath,
      ],
    });
    const stat = await fs.stat(retryPath).catch(() => null);
    return stat && stat.size >= 1_024 ? retryPath : null;
  } catch {
    return null;
  }
}

function extractAgentReplyText(payloads: unknown[]): string | null {
  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    const payload = payloads[index];
    if (!payload || typeof payload !== "object") {
      continue;
    }
    const record = payload as { text?: unknown; isError?: unknown; isReasoning?: unknown };
    if (record.isReasoning === true || typeof record.text !== "string") {
      continue;
    }
    const normalized = normalizeSpokenText(record.text);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

async function ensureAgentSession(params: {
  runtime: PluginRuntime;
  config: OpenClawConfig;
  agentId: string;
  sessionKey: string;
}): Promise<{ sessionId: string; sessionFile: string; workspaceDir: string; agentDir: string }> {
  const storePath = params.runtime.agent.session.resolveStorePath(params.config.session?.store, {
    agentId: params.agentId,
  });
  const sessionStore = params.runtime.agent.session.loadSessionStore(storePath) as Record<
    string,
    SessionStoreEntry
  >;
  const now = Date.now();
  let entry = sessionStore[params.sessionKey];
  if (!entry?.sessionId) {
    entry = {
      sessionId: crypto.randomUUID(),
      updatedAt: now,
    };
    sessionStore[params.sessionKey] = entry;
    await params.runtime.agent.session.saveSessionStore(storePath, sessionStore);
  }
  const sessionFile = params.runtime.agent.session.resolveSessionFilePath(entry.sessionId, entry, {
    agentId: params.agentId,
  });
  const workspaceDir = params.runtime.agent.resolveAgentWorkspaceDir(params.config, params.agentId);
  const agentDir = params.runtime.agent.resolveAgentDir(params.config, params.agentId);
  await params.runtime.agent.ensureAgentWorkspace({ dir: workspaceDir });
  return {
    sessionId: entry.sessionId,
    sessionFile,
    workspaceDir,
    agentDir,
  };
}

async function synthesizeAndPlay(params: {
  text: string;
  config: OpenClawConfig;
  runtime: PluginRuntime;
  voiceConfig: LinuxVoicePluginConfig;
  logger: Logger;
}): Promise<void> {
  const result = await params.runtime.tts.textToSpeech({
    text: params.text,
    cfg: params.config,
  });
  if (!result.success || !result.audioPath) {
    params.logger.warn(
      `[linux-voice] tts unavailable: ${result.error ?? "no audio output generated"}`,
    );
    return;
  }
  try {
    await playAudioFile({
      audioPath: result.audioPath,
      config: params.voiceConfig,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    params.logger.warn(`[linux-voice] playback failed: ${message}`);
  }
}

export class LinuxVoiceSession {
  private readonly runtime: PluginRuntime;
  private readonly config: OpenClawConfig;
  private readonly voiceConfig: LinuxVoicePluginConfig;
  private readonly logger: Logger;
  private readonly capture: ContinuousVoiceCapture;

  private triggers: string[] = [];
  private activeUntilMs = 0;
  private stopped = false;

  constructor(params: {
    runtime: PluginRuntime;
    config: OpenClawConfig;
    voiceConfig: LinuxVoicePluginConfig;
    logger: Logger;
  }) {
    this.runtime = params.runtime;
    this.config = params.config;
    this.voiceConfig = params.voiceConfig;
    this.logger = params.logger;
    this.capture = new ContinuousVoiceCapture({
      config: params.voiceConfig,
      logger: params.logger,
    });
  }

  private conversationActive(): boolean {
    return Date.now() < this.activeUntilMs;
  }

  private armConversation(): void {
    this.activeUntilMs = Date.now() + this.voiceConfig.conversation.followupWindowSec * 1_000;
  }

  private disarmConversation(): void {
    this.activeUntilMs = 0;
  }

  async start(): Promise<void> {
    if (process.platform !== "linux") {
      throw new Error("linux-voice is only supported on Linux hosts.");
    }
    const stateDir = this.runtime.state.resolveStateDir();
    this.triggers = await loadVoiceWakeTriggers(stateDir);
    const backend = await this.capture.start();
    this.logger.info(
      `[linux-voice] listening with ${backend}; wake words: ${this.triggers.join(", ")}`,
    );

    while (!this.stopped) {
      const utterance = await this.capture.waitForUtterance();
      this.logger.info(
        `[linux-voice] utterance detected: duration=${utterance.durationMs}ms rms=${utterance.rms.toFixed(4)}`,
      );
      await this.capture.pause();
      try {
        await this.handleUtterance(utterance.pcm, utterance.durationMs);
      } finally {
        if (!this.stopped) {
          await this.capture.resume();
        }
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.disarmConversation();
    await this.capture.stop();
  }

  private async transcribeAudioFile(filePath: string): Promise<string | null> {
    try {
      const transcriptResult = await this.runtime.mediaUnderstanding.transcribeAudioFile({
        filePath,
        cfg: this.config,
        mime: "audio/wav",
      });
      return transcriptResult.text?.trim() || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[linux-voice] transcription failed: ${message}`);
      return null;
    }
  }

  private async transcribeAudioFileWithRetry(filePath: string): Promise<string | null> {
    const transcript = await this.transcribeAudioFile(filePath);
    if (transcript) {
      return transcript;
    }
    const retryPath = await prepareRetryTranscriptionAudio({
      filePath,
      sampleRate: this.voiceConfig.capture.sampleRate,
      channels: this.voiceConfig.capture.channels,
    });
    if (!retryPath) {
      return null;
    }
    const retried = await this.transcribeAudioFile(retryPath);
    if (retried) {
      this.logger.info("[linux-voice] transcript recovered after audio retry preprocessing");
    }
    return retried;
  }

  private async handleUtterance(pcm: Buffer, durationMs: number): Promise<void> {
    const wav = await writeTempWav({
      pcm,
      sampleRate: this.voiceConfig.capture.sampleRate,
      channels: this.voiceConfig.capture.channels,
    });
    try {
      const transcript = await this.transcribeAudioFileWithRetry(wav.filePath);
      if (!transcript) {
        const debugPath = await preserveDebugUtterance({
          stateDir: this.runtime.state.resolveStateDir(),
          filePath: wav.filePath,
          durationMs,
          reason: "empty-transcript",
        }).catch(() => null);
        this.logger.info(
          `[linux-voice] empty transcript (${durationMs}ms)${debugPath ? `; saved=${debugPath}` : ""}`,
        );
        return;
      }
      this.logger.info(
        `[linux-voice] transcript (${durationMs}ms): ${transcript.replace(/\s+/g, " ")}`,
      );

      const conversationActive = this.conversationActive();
      let action = decideTranscriptAction({
        transcript,
        triggers: this.triggers,
        stopPhrases: this.voiceConfig.wake.stopPhrases,
        conversationActive,
      });

      if (action.kind === "ignore" && !conversationActive) {
        const retryPath = await prepareRetryTranscriptionAudio({
          filePath: wav.filePath,
          sampleRate: this.voiceConfig.capture.sampleRate,
          channels: this.voiceConfig.capture.channels,
        });
        const retryTranscript = retryPath ? await this.transcribeAudioFile(retryPath) : null;
        if (
          retryTranscript &&
          normalizeTranscript(retryTranscript) !== normalizeTranscript(transcript)
        ) {
          this.logger.info(
            `[linux-voice] retry transcript (${durationMs}ms): ${retryTranscript.replace(/\s+/g, " ")}`,
          );
          const retryAction = decideTranscriptAction({
            transcript: retryTranscript,
            triggers: this.triggers,
            stopPhrases: this.voiceConfig.wake.stopPhrases,
            conversationActive: false,
          });
          if (retryAction.kind !== "ignore") {
            action = retryAction;
          }
        }
      }

      if (action.kind === "ignore") {
        const debugPath = !conversationActive
          ? await preserveDebugUtterance({
              stateDir: this.runtime.state.resolveStateDir(),
              filePath: wav.filePath,
              durationMs,
              reason: "wake-miss",
            }).catch(() => null)
          : null;
        if (!conversationActive) {
          this.logger.info(
            `[linux-voice] ignored transcript without wake word: ${transcript.replace(/\s+/g, " ")}${debugPath ? `; saved=${debugPath}` : ""}`,
          );
        }
        return;
      }
      if (action.kind === "disarm") {
        this.disarmConversation();
        this.logger.info("[linux-voice] conversation disarmed");
        return;
      }
      if (action.kind === "ack") {
        this.armConversation();
        this.logger.info(`[linux-voice] wake acknowledged by "${action.trigger}"`);
        if (this.voiceConfig.playback.enabled) {
          await synthesizeAndPlay({
            text: this.voiceConfig.conversation.ackText,
            config: this.config,
            runtime: this.runtime,
            voiceConfig: this.voiceConfig,
            logger: this.logger,
          });
        }
        return;
      }

      const reply = await this.runAgentPrompt(action.prompt);
      if (!reply) {
        return;
      }
      this.armConversation();
      this.logger.info(`[linux-voice] reply: ${reply}`);
      if (this.voiceConfig.playback.enabled) {
        await synthesizeAndPlay({
          text: reply,
          config: this.config,
          runtime: this.runtime,
          voiceConfig: this.voiceConfig,
          logger: this.logger,
        });
      }
    } finally {
      await fs.rm(wav.dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async runAgentPrompt(prompt: string): Promise<string | null> {
    const agentState = await ensureAgentSession({
      runtime: this.runtime,
      config: this.config,
      agentId: this.voiceConfig.agentId,
      sessionKey: this.voiceConfig.sessionKey,
    });

    const defaultsModel = this.config.agents?.defaults?.model;
    const providerModel =
      typeof defaultsModel === "string" ? defaultsModel.trim() : defaultsModel?.primary?.trim();
    const slashIndex = providerModel?.indexOf("/") ?? -1;
    const provider =
      typeof providerModel === "string" && slashIndex > 0
        ? providerModel.slice(0, slashIndex)
        : undefined;
    const model =
      typeof providerModel === "string" && slashIndex > 0
        ? providerModel.slice(slashIndex + 1)
        : undefined;

    const result = await this.runtime.agent.runEmbeddedPiAgent({
      sessionId: agentState.sessionId,
      sessionKey: this.voiceConfig.sessionKey,
      sessionFile: agentState.sessionFile,
      workspaceDir: agentState.workspaceDir,
      agentDir: agentState.agentDir,
      config: this.config,
      prompt: `${VOICE_PREFIX}\n\n${prompt}`,
      provider,
      model,
      messageProvider: "voice",
      messageChannel: "voicewake",
      thinkLevel: this.voiceConfig.conversation.thinkLevel,
      verboseLevel: "off",
      timeoutMs: this.voiceConfig.conversation.responseTimeoutMs,
      runId: `linux-voice:${Date.now()}`,
      lane: "voice",
      trigger: "user",
      extraSystemPrompt:
        "You are speaking back over Linux terminal voice mode. Keep responses concise, natural, and easy to listen to. Avoid markdown, bullet lists, tables, and code fences unless the user explicitly asks for them.",
    });

    return extractAgentReplyText(result.payloads ?? []);
  }
}
