import type { Command } from "commander";
import chalk from "chalk";
import { loadStore } from "../lib/store.js";
import { verifyGitHubIdentity } from "../lib/ssh.js";

export function registerCurrentCommand(program: Command): void {
  program
    .command("current")
    .alias("whoami")
    .description("Show the active profile and verify it against GitHub")
    .action(async () => {
      const store = await loadStore();
      if (!store.activeAlias) {
        console.log(chalk.yellow("No active profile. Run `gitsw use <alias>`."));
        return;
      }

      const profile = store.profiles.find((p) => p.alias === store.activeAlias);
      if (!profile) {
        console.log(chalk.red("Active alias points to a profile that no longer exists."));
        return;
      }

      console.log(`${chalk.bold("Declared:")} ${profile.alias} — ${profile.name} <${profile.email}>`);

      if (profile.authType === "ssh") {
        const result = await verifyGitHubIdentity("github.com");
        if (result.ok) {
          console.log(`${chalk.bold("Verified via SSH:")} ${chalk.green(`Hi ${result.username}!`)}`);
        } else {
          console.log(chalk.red("Could not verify via SSH — is the public key added to GitHub yet?"));
          console.log(chalk.dim(result.raw));
        }
      } else {
        console.log(chalk.dim("HTTPS profile — credential verification arrives in phase 3."));
      }
    });
}