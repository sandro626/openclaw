import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { waitForCaptureReady } from "./audio.js";

type TestCaptureProcess = ChildProcessByStdio<null, Readable, Readable>;

const children: Array<TestCaptureProcess> = [];

function trackChild(child: TestCaptureProcess) {
  children.push(child);
  return child;
}

afterEach(async () => {
  await Promise.all(
    children.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.killed) {
            resolve();
            return;
          }
          child.once("close", () => resolve());
          child.kill("SIGTERM");
          setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 500).unref();
        }),
    ),
  );
});

describe("waitForCaptureReady", () => {
  it("treats a quiet long-running capture process as ready", async () => {
    const child = trackChild(
      spawn(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], {
        stdio: ["ignore", "pipe", "pipe"],
      }) as unknown as TestCaptureProcess,
    );

    const result = await waitForCaptureReady(child, 50);

    expect("firstChunk" in result).toBe(true);
    if ("firstChunk" in result) {
      expect(result.firstChunk.length).toBe(0);
    }
  });

  it("returns the first chunk when capture data arrives quickly", async () => {
    const child = trackChild(
      spawn(process.execPath, ["-e", "process.stdout.write('abcd'); setTimeout(() => {}, 5000)"], {
        stdio: ["ignore", "pipe", "pipe"],
      }) as unknown as TestCaptureProcess,
    );

    const result = await waitForCaptureReady(child, 200);

    expect("firstChunk" in result).toBe(true);
    if ("firstChunk" in result) {
      expect(result.firstChunk.toString("utf8")).toBe("abcd");
    }
  });

  it("reports an early capture startup failure", async () => {
    const child = trackChild(
      spawn(process.execPath, ["-e", "process.stderr.write('boom'); process.exit(1)"], {
        stdio: ["ignore", "pipe", "pipe"],
      }) as unknown as TestCaptureProcess,
    );

    const result = await waitForCaptureReady(child, 200);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.message).toContain("boom");
    }
  });
});
