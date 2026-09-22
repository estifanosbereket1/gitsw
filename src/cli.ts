#!/usr/bin/env node
import { Command } from "commander";
import { registerAddCommand } from "./commands/add.js";
import { registerListCommand } from "./commands/list.js";
import { registerRemoveCommand } from "./commands/remove.js";
import { registerUseCommand } from "./commands/use.js";
import { registerCurrentCommand } from "./commands/current.js";
import { registerPinCommand } from "./commands/pin.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerGuardCommands } from "./commands/guard.js";
import { registerLinkCommands } from "./commands/link.js";
import { registerWelcomeAction } from "./commands/welcome.js";
import { fail, dim } from "./lib/ui.js";

const program = new Command();

program
  .name("gitsw")
  .description("Switch safely between multiple GitHub accounts")
  .version("0.1.0")
  .addHelpText(
    "after",
    `
Examples:
  $ gitsw add                     add a new account profile
  $ gitsw use                     switch accounts (interactive picker)
  $ gitsw pin work                lock the current repo to "work"
  $ gitsw link work ~/work        auto-apply "work" to everything under ~/work
  $ gitsw doctor ~/projects       audit every repo under a folder
`
  );

registerAddCommand(program);
registerListCommand(program);
registerRemoveCommand(program);
registerUseCommand(program);
registerCurrentCommand(program);
registerPinCommand(program);
registerDoctorCommand(program);
registerGuardCommands(program);
registerLinkCommands(program);
registerWelcomeAction(program);

function isExitPromptError(err: unknown): boolean {
  return err instanceof Error && err.name === "ExitPromptError";
}

function handleFatal(err: unknown): never {
  if (isExitPromptError(err)) {
    console.log();
    dim("Cancelled.");
    process.exit(130); // 128 + SIGINT(2) — standard convention for "killed by Ctrl+C"
  }
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

// Covers Ctrl+C landing outside an active prompt (e.g. mid-spinner, mid-network-call).
process.on("SIGINT", () => {
  console.log();
  dim("Cancelled.");
  process.exit(130);
});

// Safety net for anything that rejects without being awaited in the parseAsync chain.
process.on("unhandledRejection", handleFatal);

async function main(): Promise<void> {
  try {
    await program.parseAsync();
  } catch (err) {
    handleFatal(err);
  }
}

main();
