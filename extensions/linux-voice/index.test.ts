import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPluginRuntimeMock } from "../../test/helpers/extensions/plugin-runtime-mock.js";
import plugin from "./index.js";

type RegisterCliContext = {
  program: Command;
  config: Record<string, unknown>;
  logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
};

function registerCli(program: Command, pluginConfig?: Record<string, unknown>) {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const runtime = createPluginRuntimeMock({
    state: {
      resolveStateDir: vi.fn(() => "/tmp/openclaw-state"),
    },
  });
  void plugin.register?.({
    id: "linux-voice",
    name: "Linux Voice",
    description: "test",
    version: "0",
    source: "test",
    config: {},
    pluginConfig,
    runtime,
    logger,
    registerCli: (fn: (ctx: RegisterCliContext) => void) =>
      fn({
        program,
        config: {},
        logger,
      }),
    registerGatewayMethod: () => {},
    registerTool: () => {},
    registerService: () => {},
    resolvePath: (value: string) => value,
  } as never);
  return { runtime };
}

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
});

describe("linux-voice plugin", () => {
  it("registers the root voice CLI command", () => {
    const program = new Command();
    registerCli(program);
    const voice = program.commands.find((command) => command.name() === "voice");
    expect(voice).toBeTruthy();
    expect(voice?.commands.map((command) => command.name())).toEqual(["start", "doctor"]);
  });

  it("prints doctor output with wake-word state", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => {
      void chunk;
      return true;
    }) as typeof process.stdout.write);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "linux-voice-doctor-"));
    tempDirs.push(dir);
    await fs.mkdir(path.join(dir, "settings"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "settings", "voicewake.json"),
      JSON.stringify({ triggers: ["openclaw", "hello claw"] }),
    );
    try {
      const program = new Command();
      const { runtime } = registerCli(program);
      vi.mocked(runtime.state.resolveStateDir).mockReturnValue(dir);
      await program.parseAsync(["node", "openclaw", "voice", "doctor"], { from: "node" });
      const output = stdout.mock.calls.map((call) => String(call[0])).join("");
      expect(output).toContain("Linux voice doctor:");
      expect(output).toContain("wakeWords: openclaw, hello claw");
    } finally {
      stdout.mockRestore();
    }
  });
});
