import type { Command } from "commander";

const PLUGIN_ROOT_COMMAND_MARKER = Symbol("openclaw.pluginRootCommand");

function getTopLevelCommand(command: Command): Command {
  let current = command;
  while (current.parent && current.parent.parent) {
    current = current.parent;
  }
  return current;
}

export function markPluginRootCommand(command: Command): void {
  Reflect.set(command, PLUGIN_ROOT_COMMAND_MARKER, true);
}

export function markPluginRootCommands(program: Command, commandNames: readonly string[]): void {
  if (commandNames.length === 0) {
    return;
  }
  for (const command of program.commands) {
    if (!commandNames.includes(command.name())) {
      continue;
    }
    markPluginRootCommand(command);
  }
}

export function isPluginRootCommand(command: Command): boolean {
  return Reflect.get(getTopLevelCommand(command), PLUGIN_ROOT_COMMAND_MARKER) === true;
}
