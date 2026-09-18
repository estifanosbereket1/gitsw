import type { Command } from "commander";
import chalk from "chalk";
import { listProfiles } from "../lib/store.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List saved GitHub account profiles")
    .action(async () => {
      const profiles = await listProfiles();
      if (profiles.length === 0) {
        console.log(chalk.yellow("No profiles yet. Run `gitsw add` to create one."));
        return;
      }
      for (const p of profiles) {
        console.log(`${chalk.bold(p.alias)} — ${p.name} <${p.email}> (${p.authType})`);
      }
    });
}