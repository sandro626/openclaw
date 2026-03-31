export type LinuxVoiceThinkLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "adaptive";

export type LinuxVoicePluginConfig = {
  enabled: boolean;
  agentId: string;
  sessionKey: string;
  capture: {
    inputFormat: "auto" | "alsa" | "pulse";
    inputDevice?: string;
    sampleRate: number;
    channels: number;
    vadThreshold: number;
    vadStartMs: number;
    vadStopMs: number;
    preRollMs: number;
    minUtteranceMs: number;
    maxUtteranceMs: number;
  };
  conversation: {
    followupWindowSec: number;
    thinkLevel: LinuxVoiceThinkLevel;
    responseTimeoutMs: number;
    ackText: string;
  };
  playback: {
    enabled: boolean;
    player: "auto" | "ffplay";
    volume: number;
  };
  wake: {
    stopPhrases: string[];
  };
};

const THINK_LEVELS = new Set<LinuxVoiceThinkLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "adaptive",
]);

export const DEFAULT_LINUX_VOICE_CONFIG: LinuxVoicePluginConfig = {
  enabled: true,
  agentId: "main",
  sessionKey: "voice:terminal",
  capture: {
    inputFormat: "auto",
    sampleRate: 16_000,
    channels: 1,
    vadThreshold: 0.015,
    vadStartMs: 180,
    vadStopMs: 900,
    preRollMs: 250,
    minUtteranceMs: 400,
    maxUtteranceMs: 15_000,
  },
  conversation: {
    followupWindowSec: 20,
    thinkLevel: "low",
    responseTimeoutMs: 120_000,
    ackText: "我在。",
  },
  playback: {
    enabled: true,
    player: "auto",
    volume: 100,
  },
  wake: {
    stopPhrases: ["stop listening", "停止", "退出", "结束语音", "结束对话"],
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function asInteger(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(asNumber(value, fallback, min, max));
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const cleaned = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return cleaned.length > 0 ? cleaned : fallback;
}

function resolveThinkLevel(value: unknown, fallback: LinuxVoiceThinkLevel): LinuxVoiceThinkLevel {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase() as LinuxVoiceThinkLevel;
  return THINK_LEVELS.has(normalized) ? normalized : fallback;
}

export function resolveLinuxVoiceConfig(value: unknown): LinuxVoicePluginConfig {
  const raw = asRecord(value);
  const capture = asRecord(raw.capture);
  const conversation = asRecord(raw.conversation);
  const playback = asRecord(raw.playback);
  const wake = asRecord(raw.wake);

  const inputFormatRaw = asString(
    capture.inputFormat,
    DEFAULT_LINUX_VOICE_CONFIG.capture.inputFormat,
  );
  const inputFormat =
    inputFormatRaw === "alsa" || inputFormatRaw === "pulse" ? inputFormatRaw : "auto";
  const playerRaw = asString(playback.player, DEFAULT_LINUX_VOICE_CONFIG.playback.player);
  const player = playerRaw === "ffplay" ? "ffplay" : "auto";

  return {
    enabled: asBoolean(raw.enabled, DEFAULT_LINUX_VOICE_CONFIG.enabled),
    agentId: asString(raw.agentId, DEFAULT_LINUX_VOICE_CONFIG.agentId),
    sessionKey: asString(raw.sessionKey, DEFAULT_LINUX_VOICE_CONFIG.sessionKey),
    capture: {
      inputFormat,
      inputDevice: asOptionalString(capture.inputDevice),
      sampleRate: asInteger(
        capture.sampleRate,
        DEFAULT_LINUX_VOICE_CONFIG.capture.sampleRate,
        8_000,
        48_000,
      ),
      channels: asInteger(capture.channels, DEFAULT_LINUX_VOICE_CONFIG.capture.channels, 1, 2),
      vadThreshold: asNumber(
        capture.vadThreshold,
        DEFAULT_LINUX_VOICE_CONFIG.capture.vadThreshold,
        0.001,
        1,
      ),
      vadStartMs: asInteger(
        capture.vadStartMs,
        DEFAULT_LINUX_VOICE_CONFIG.capture.vadStartMs,
        20,
        5_000,
      ),
      vadStopMs: asInteger(
        capture.vadStopMs,
        DEFAULT_LINUX_VOICE_CONFIG.capture.vadStopMs,
        100,
        10_000,
      ),
      preRollMs: asInteger(
        capture.preRollMs,
        DEFAULT_LINUX_VOICE_CONFIG.capture.preRollMs,
        0,
        5_000,
      ),
      minUtteranceMs: asInteger(
        capture.minUtteranceMs,
        DEFAULT_LINUX_VOICE_CONFIG.capture.minUtteranceMs,
        100,
        10_000,
      ),
      maxUtteranceMs: asInteger(
        capture.maxUtteranceMs,
        DEFAULT_LINUX_VOICE_CONFIG.capture.maxUtteranceMs,
        1_000,
        60_000,
      ),
    },
    conversation: {
      followupWindowSec: asInteger(
        conversation.followupWindowSec,
        DEFAULT_LINUX_VOICE_CONFIG.conversation.followupWindowSec,
        0,
        3_600,
      ),
      thinkLevel: resolveThinkLevel(
        conversation.thinkLevel,
        DEFAULT_LINUX_VOICE_CONFIG.conversation.thinkLevel,
      ),
      responseTimeoutMs: asInteger(
        conversation.responseTimeoutMs,
        DEFAULT_LINUX_VOICE_CONFIG.conversation.responseTimeoutMs,
        1_000,
        600_000,
      ),
      ackText: asString(conversation.ackText, DEFAULT_LINUX_VOICE_CONFIG.conversation.ackText),
    },
    playback: {
      enabled: asBoolean(playback.enabled, DEFAULT_LINUX_VOICE_CONFIG.playback.enabled),
      player,
      volume: asInteger(playback.volume, DEFAULT_LINUX_VOICE_CONFIG.playback.volume, 0, 100),
    },
    wake: {
      stopPhrases: asStringList(wake.stopPhrases, DEFAULT_LINUX_VOICE_CONFIG.wake.stopPhrases),
    },
  };
}
