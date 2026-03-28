/**
 * WeCom Runtime - 共享运行时环境
 */

import type { PluginRuntime } from "../api.js";

let runtime: PluginRuntime | null = null;

export function setWeComRuntime(r: PluginRuntime): void {
  runtime = r;
}

export function getWeComRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WeCom runtime not initialized - plugin not registered");
  }
  return runtime;
}
