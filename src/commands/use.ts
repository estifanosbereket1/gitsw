import type { Command } from "commander";
import chalk from "chalk";
import { execa } from "execa";
import { loadStore, saveStore } from "../lib/store.js";
import { upsertHostAlias } from "../lib/ssh.js";

export function registerUseCommand(program: Command): void {
  program
    .command("use <alias>")
    .description("Switch the global default GitHub identity")
    .action(async (alias: string) => {
      const store = await loadStore();
      const profile = store.profiles.find((p) => p.alias === alias);
      if (!profile) {
        console.error(chalk.red(`No profile named "${alias}". Run \`gitsw list\`.`));
        process.exitCode = 1;
        return;
      }

      await execa("git", ["config", "--global", "user.name", profile.name]);
      await execa("git", ["config", "--global", "user.email", profile.email]);

      if (profile.authType === "ssh" && profile.ssh) {
        await upsertHostAlias("github.com", profile.ssh.keyPath);
      }

      store.activeAlias = alias;
      await saveStore(store);

      console.log(chalk.green(`✔ Switched to "${alias}" (${profile.name} <${profile.email}>)`));
      if (profile.authType === "ssh") {
        console.log(chalk.dim("  Default SSH identity updated for unaliased git@github.com remotes."));
      }
    });
}