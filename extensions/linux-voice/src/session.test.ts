import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { decideTranscriptAction, extractWakeRequest, loadVoiceWakeTriggers } from "./session.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "linux-voice-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
});

describe("linux-voice session helpers", () => {
  it("extracts prompt text after the wake word", () => {
    expect(extractWakeRequest("OpenClaw，帮我总结今天的提交", ["claude", "openclaw"])).toEqual({
      trigger: "openclaw",
      prompt: "帮我总结今天的提交",
    });
  });

  it("supports trigger-only acknowledgements and active follow-up turns", () => {
    expect(
      decideTranscriptAction({
        transcript: "openclaw",
        triggers: ["openclaw"],
        stopPhrases: ["停止"],
        conversationActive: false,
      }),
    ).toEqual({ kind: "ack", trigger: "openclaw" });

    expect(
      decideTranscriptAction({
        transcript: "继续说刚才那个部署问题",
        triggers: ["openclaw"],
        stopPhrases: ["停止"],
        conversationActive: true,
      }),
    ).toEqual({ kind: "prompt", prompt: "继续说刚才那个部署问题" });
  });

  it("disarms on configured stop phrases", () => {
    expect(
      decideTranscriptAction({
        transcript: "停止",
        triggers: ["openclaw"],
        stopPhrases: ["停止", "退出"],
        conversationActive: true,
      }),
    ).toEqual({ kind: "disarm" });
  });

  it("loads wake words from the gateway-owned settings file", async () => {
    const dir = await createTempDir();
    await fs.mkdir(path.join(dir, "settings"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "settings", "voicewake.json"),
      JSON.stringify({ triggers: [" openclaw ", "", "computer"] }),
    );
    await expect(loadVoiceWakeTriggers(dir)).resolves.toEqual(["openclaw", "computer"]);
  });

  it("falls back to default wake words when settings are missing", async () => {
    const dir = await createTempDir();
    await expect(loadVoiceWakeTriggers(dir)).resolves.toEqual(["openclaw", "claude", "computer"]);
  });
});
