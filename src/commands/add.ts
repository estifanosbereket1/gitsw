import type { Command } from "commander";
import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { addProfile } from "../lib/store.js";
import type { Profile } from "../types.js";

export function registerAddCommand(program: Command): void {
  program
    .command("add")
    .description("Add a new GitHub account profile")
    .action(async () => {
      const alias = await input({
        message: "Short alias for this profile (e.g. work1, personal):",
        validate: (v) => (v.trim().length > 0 ? true : "Alias can't be empty"),
      });

      const name = await input({ message: "Git user.name for this account:" });

      const email = await input({
        message: "Git user.email for this account:",
        validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
      });

      const authType = await select({
        message: "How does this account authenticate?",
        choices: [
          { name: "SSH key", value: "ssh" as const },
          { name: "HTTPS (token via credential helper)", value: "https" as const },
        ],
      });

      const profile: Profile = { alias: alias.trim(), name, email, authType };

      if (authType === "https") {
        profile.https = {
          username: await input({ message: "GitHub username for this account:" }),
        };
      }
      // SSH key generation + ~/.ssh/config wiring lands in phase 2.

      try {
        await addProfile(profile);
        console.log(chalk.green(`✔ Added profile "${profile.alias}"`));
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exitCode = 1;
      }
    });
}