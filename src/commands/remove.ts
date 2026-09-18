import type { Command } from "commander";
import chalk from "chalk";
import { removeProfile } from "../lib/store.js";

export function registerRemoveCommand(program: Command): void {
  program
    .command("remove <alias>")
    .description("Remove a saved profile")
    .action(async (alias: string) => {
      try {
        await removeProfile(alias);
        console.log(chalk.green(`✔ Removed profile "${alias}"`));
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exitCode = 1;
      }
    });
}