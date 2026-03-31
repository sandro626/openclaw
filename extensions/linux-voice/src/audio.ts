import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type { LinuxVoicePluginConfig } from "./config.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
};

const PCM_BYTES_PER_SAMPLE = 2;
const PCM_FRAME_MS = 20;

export type CaptureCandidate = {
  label: string;
  command: string;
  args: string[];
};

export type CaptureUtterance = {
  pcm: Buffer;
  durationMs: number;
  rms: number;
};

type CaptureWaiter = {
  resolve: (value: CaptureUtterance) => void;
  reject: (error: Error) => void;
};

type CaptureProcess = ChildProcessByStdio<null, Readable, Readable>;

function once<T>(fn: (value: T) => void): (value: T) => void {
  let called = false;
  return (value: T) => {
    if (called) {
      return;
    }
    called = true;
    fn(value);
  };
}

function frameBytes(config: LinuxVoicePluginConfig): number {
  return Math.round(
    (config.capture.sampleRate * config.capture.channels * PCM_BYTES_PER_SAMPLE * PCM_FRAME_MS) /
      1_000,
  );
}

function framesForMs(ms: number): number {
  return Math.max(1, Math.ceil(ms / PCM_FRAME_MS));
}

export function buildCaptureCandidates(config: LinuxVoicePluginConfig): CaptureCandidate[] {
  const device = config.capture.inputDevice ?? "default";
  const formats =
    config.capture.inputFormat === "auto"
      ? (["pulse", "alsa"] as const)
      : [config.capture.inputFormat];
  return formats.map((format) => ({
    label: `ffmpeg:${format}:${device}`,
    command: "ffmpeg",
    args: [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      format,
      "-i",
      device,
      "-ac",
      String(config.capture.channels),
      "-ar",
      String(config.capture.sampleRate),
      "-f",
      "s16le",
      "pipe:1",
    ],
  }));
}

export function buildPlaybackCommand(params: {
  audioPath: string;
  config: LinuxVoicePluginConfig;
}): { command: string; args: string[] } {
  return {
    command: "ffplay",
    args: [
      "-nodisp",
      "-autoexit",
      "-loglevel",
      "error",
      "-volume",
      String(params.config.playback.volume),
      params.audioPath,
    ],
  };
}

function computeNormalizedRms(pcm: Buffer): number {
  const samples = Math.floor(pcm.length / PCM_BYTES_PER_SAMPLE);
  if (samples <= 0) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < samples; index += 1) {
    const sample = pcm.readInt16LE(index * PCM_BYTES_PER_SAMPLE) / 32768;
    total += sample * sample;
  }
  return Math.sqrt(total / samples);
}

export async function waitForCaptureReady(
  process: CaptureProcess,
  timeoutMs: number,
): Promise<{ firstChunk: Buffer } | { error: Error }> {
  return await new Promise((resolve) => {
    let stderr = "";
    const finish = once((result: { firstChunk: Buffer } | { error: Error }) => {
      clearTimeout(timer);
      process.stdout.off("data", onData);
      process.stderr.off("data", onStderr);
      process.off("error", onError);
      process.off("close", onClose);
      resolve(result);
    });
    const onData = (chunk: Buffer) => {
      finish({ firstChunk: Buffer.from(chunk) });
    };
    const onStderr = (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    };
    const onError = (error: Error) => {
      finish({ error });
    };
    const onClose = (code: number | null) => {
      const detail = stderr.trim() || `process exited before audio capture was ready (${code})`;
      finish({ error: new Error(detail) });
    };
    const timer = setTimeout(() => {
      // Some ffmpeg capture backends buffer PCM for a while before emitting
      // the first chunk on stdout. Treat a stable child process as ready and
      // let normal runtime handlers consume audio once it starts flowing.
      finish({ firstChunk: Buffer.alloc(0) });
    }, timeoutMs);
    process.stdout.once("data", onData);
    process.stderr.on("data", onStderr);
    process.once("error", onError);
    process.once("close", onClose);
  });
}

function killProcess(process: CaptureProcess | null): Promise<void> {
  if (!process || process.killed) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      resolve();
    };
    process.once("close", finish);
    process.kill("SIGTERM");
    setTimeout(() => {
      if (!process.killed) {
        process.kill("SIGKILL");
      }
      finish();
    }, 1_000).unref();
  });
}

export async function playAudioFile(params: {
  audioPath: string;
  config: LinuxVoicePluginConfig;
}): Promise<void> {
  const playback = buildPlaybackCommand(params);
  await new Promise<void>((resolve, reject) => {
    const process = spawn(playback.command, playback.args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `playback failed with exit code ${code}`));
    });
  });
}

export class ContinuousVoiceCapture {
  private readonly config: LinuxVoicePluginConfig;
  private readonly logger: Logger;
  private readonly candidates: CaptureCandidate[];
  private readonly utteranceQueue: CaptureUtterance[] = [];
  private readonly waiters: CaptureWaiter[] = [];
  private readonly startFrames: number;
  private readonly stopFrames: number;
  private readonly preRollFramesLimit: number;
  private readonly minFrames: number;
  private readonly maxFrames: number;
  private readonly frameBytes: number;
  private readonly preRollFrames: Buffer[] = [];
  private readonly utteranceFrames: Buffer[] = [];

  private process: CaptureProcess | null = null;
  private readyCandidate: CaptureCandidate | null = null;
  private pendingRemainder: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private speechActive = false;
  private consecutiveVoiceFrames = 0;
  private trailingSilenceFrames = 0;
  private stopped = false;
  private paused = false;
  private fatalError: Error | null = null;

  constructor(params: { config: LinuxVoicePluginConfig; logger: Logger }) {
    this.config = params.config;
    this.logger = params.logger;
    this.candidates = buildCaptureCandidates(params.config);
    this.frameBytes = frameBytes(params.config);
    this.startFrames = framesForMs(params.config.capture.vadStartMs);
    this.stopFrames = framesForMs(params.config.capture.vadStopMs);
    this.preRollFramesLimit = framesForMs(params.config.capture.preRollMs);
    this.minFrames = framesForMs(params.config.capture.minUtteranceMs);
    this.maxFrames = framesForMs(params.config.capture.maxUtteranceMs);
  }

  get activeCaptureLabel(): string | undefined {
    return this.readyCandidate?.label;
  }

  async start(): Promise<string> {
    this.stopped = false;
    this.paused = false;
    await this.startProcess();
    return this.readyCandidate?.label ?? "unknown";
  }

  async pause(): Promise<void> {
    if (this.paused || this.stopped) {
      return;
    }
    this.paused = true;
    await this.stopProcess();
    this.resetFrameState();
  }

  async resume(): Promise<void> {
    if (!this.paused || this.stopped) {
      return;
    }
    this.paused = false;
    await this.startProcess();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.paused = false;
    await this.stopProcess();
    this.resetFrameState();
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.reject(new Error("voice capture stopped"));
    }
  }

  async waitForUtterance(): Promise<CaptureUtterance> {
    if (this.fatalError) {
      throw this.fatalError;
    }
    const queued = this.utteranceQueue.shift();
    if (queued) {
      return queued;
    }
    return await new Promise<CaptureUtterance>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  private async startProcess(): Promise<void> {
    const errors: string[] = [];
    for (const candidate of this.candidates) {
      const process = spawn(candidate.command, candidate.args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const ready = await waitForCaptureReady(process, 2_000);
      if ("error" in ready) {
        errors.push(`${candidate.label}: ${ready.error.message}`);
        await killProcess(process);
        continue;
      }
      this.process = process;
      this.readyCandidate = candidate;
      this.attachRuntimeHandlers(process, candidate);
      if (ready.firstChunk.length > 0) {
        this.handleChunk(ready.firstChunk);
      }
      this.logger.info(`[linux-voice] capture ready via ${candidate.label}`);
      return;
    }
    throw new Error(
      `Unable to open Linux microphone capture. Tried: ${errors.join("; ") || "no candidates"}`,
    );
  }

  private attachRuntimeHandlers(process: CaptureProcess, candidate: CaptureCandidate): void {
    process.stdout.on("data", (chunk: Buffer) => {
      this.handleChunk(chunk);
    });
    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    process.once("error", (error) => {
      this.failCapture(new Error(`${candidate.label}: ${error.message}`));
    });
    process.once("close", (code) => {
      if (this.stopped || this.paused) {
        return;
      }
      const detail = stderr.trim() || `${candidate.label} exited with code ${code}`;
      this.failCapture(new Error(detail));
    });
  }

  private async stopProcess(): Promise<void> {
    await killProcess(this.process);
    this.process = null;
    this.readyCandidate = null;
  }

  private failCapture(error: Error): void {
    if (this.fatalError) {
      return;
    }
    this.fatalError = error;
    this.logger.error(`[linux-voice] capture failed: ${error.message}`);
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.reject(error);
    }
  }

  private handleChunk(chunk: Buffer): void {
    if (this.stopped || this.paused || this.fatalError) {
      return;
    }
    this.pendingRemainder =
      this.pendingRemainder.length > 0 ? Buffer.concat([this.pendingRemainder, chunk]) : chunk;
    while (this.pendingRemainder.length >= this.frameBytes) {
      const frame = this.pendingRemainder.subarray(0, this.frameBytes);
      this.pendingRemainder = this.pendingRemainder.subarray(this.frameBytes);
      this.handleFrame(frame);
    }
  }

  private handleFrame(frame: Buffer): void {
    const rms = computeNormalizedRms(frame);
    const voiced = rms >= this.config.capture.vadThreshold;

    if (this.speechActive) {
      this.utteranceFrames.push(frame);
      if (voiced) {
        this.trailingSilenceFrames = 0;
      } else {
        this.trailingSilenceFrames += 1;
      }
      if (
        this.trailingSilenceFrames >= this.stopFrames ||
        this.utteranceFrames.length >= this.maxFrames
      ) {
        this.finalizeUtterance();
      }
      return;
    }

    this.preRollFrames.push(frame);
    while (this.preRollFrames.length > this.preRollFramesLimit) {
      this.preRollFrames.shift();
    }

    if (voiced) {
      this.consecutiveVoiceFrames += 1;
      if (this.consecutiveVoiceFrames >= this.startFrames) {
        this.speechActive = true;
        this.utteranceFrames.push(...this.preRollFrames);
        this.preRollFrames.length = 0;
        this.trailingSilenceFrames = 0;
      }
      return;
    }

    this.consecutiveVoiceFrames = 0;
  }

  private finalizeUtterance(): void {
    const frames = this.utteranceFrames.splice(0);
    this.resetFrameState();
    if (frames.length < this.minFrames) {
      return;
    }
    const pcm = Buffer.concat(frames);
    const utterance: CaptureUtterance = {
      pcm,
      durationMs: Math.round((frames.length * PCM_FRAME_MS * 10) / 10),
      rms: computeNormalizedRms(pcm),
    };
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve(utterance);
      return;
    }
    this.utteranceQueue.push(utterance);
  }

  private resetFrameState(): void {
    this.pendingRemainder = Buffer.alloc(0);
    this.preRollFrames.length = 0;
    this.utteranceFrames.length = 0;
    this.speechActive = false;
    this.consecutiveVoiceFrames = 0;
    this.trailingSilenceFrames = 0;
  }
}
