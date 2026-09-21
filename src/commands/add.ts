import type { Command } from "commander";
import chalk from "chalk";
import { promises as fs } from "node:fs";
import { addProfile, loadStore } from "../lib/store.js";
import { generateSshKey, upsertHostAlias, importSshKey } from "../lib/ssh.js";
import type { Profile } from "../types.js";
import { approveCredential, configureCredentialStore, getCredentialHelpers, verifyGitHubIdentityHttps } from "../lib/https.js";
import { input, select, password, confirm } from "@inquirer/prompts";

export function registerAddCommand(program: Command): void {
  program
    .command("add")
    .description("Add a new GitHub account profile")
    .action(async () => {
      const alias = await input({
        message: "Short alias for this profile (e.g. work1, personal):",
        validate: async (v) => {
          if (v.trim().length === 0) return "Alias can't be empty";
          const store = await loadStore();
          if (store.profiles.some((p) => p.alias === v.trim())) {
            return `Profile "${v.trim()}" already exists`;
          }
          return true;
        },
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
        const username = await input({ message: "GitHub username for this account:" });

        let helpers = await getCredentialHelpers();
        if (helpers.length === 0) {
          console.log(chalk.yellow("\nNo git credential helper is configured — a token entered now would be silently lost."));
          const setup = await confirm({
            message: "Configure local credential storage now (git config --global credential.helper store)?",
            default: true,
          });
          if (!setup) {
            console.log(chalk.red("Can't add an HTTPS profile without a credential helper. Aborting."));
            return;
          }
          await configureCredentialStore();
          helpers = await getCredentialHelpers();
          if (helpers.length === 0) {
            console.log(chalk.red("Failed to configure a credential helper. Aborting."));
            return;
          }
          console.log(chalk.dim("Note: 'store' saves tokens in plaintext at ~/.git-credentials.\n"));
        }

        const token = await password({
          message: `Personal access token for ${username} (repo scope):`,
          mask: "*",
        });

        await approveCredential(username, token);

        console.log(chalk.dim("Verifying stored credential..."));
        const verify = await verifyGitHubIdentityHttps(username);
        if (!verify.ok) {
          console.log(chalk.red(`Could not verify the stored credential: ${verify.reason}`));
          console.log(chalk.red("Aborting — profile not saved."));
          return;
        }

        profile.https = { username };
        console.log(chalk.green(`✔ Credential stored and verified — Hi ${verify.login}!`));
        console.log(
          chalk.dim("To pin a specific repo to this account, run:\n") +
          chalk.dim(`  gitsw pin ${profile.alias}\n`)
        );
      } else {
        const hostAlias = `github.com-${profile.alias}`;

        const keyChoice = await select({
          message: "SSH key for this profile:",
          choices: [
            { name: "Import a key you already use", value: "import" as const },
            { name: "Generate a new key", value: "generate" as const },
          ],
        });

        let keyPath: string;
        let isNewKey: boolean;

        if (keyChoice === "import") {
          const rawPath = await input({
            message: "Path to your existing private key:",
            default: "~/.ssh/id_ed25519",
            validate: async (v) => {
              try {
                await importSshKey(v);
                return true;
              } catch (err) {
                return (err as Error).message;
              }
            },
          });
          keyPath = await importSshKey(rawPath);
          isNewKey = false;
        } else {
          console.log(chalk.dim(`Generating a new SSH key for "${profile.alias}"...`));
          keyPath = await generateSshKey(profile.alias, email);
          isNewKey = true;
        }

        await upsertHostAlias(hostAlias, keyPath);
        profile.ssh = { keyPath, hostAlias };

        console.log(chalk.green(`✔ Key ready at ${keyPath}`));

        if (isNewKey) {
          const pubKey = (await fs.readFile(`${keyPath}.pub`, "utf-8")).trim();
          console.log(chalk.bold("\nAdd this public key to the matching GitHub account:"));
          console.log(chalk.cyan("https://github.com/settings/keys\n"));
          console.log(pubKey + "\n");
        } else {
          console.log(
            chalk.dim("Using an existing key — make sure it's already added to this account's GitHub settings.\n")
          );
        }

        console.log(
          chalk.dim("To pin a specific repo to this account, set its remote to:\n") +
          chalk.dim(`  git@${hostAlias}:ORG/REPO.git\n`)
        );
      }

      await addProfile(profile);
      console.log(chalk.green(`✔ Added profile "${profile.alias}"`));
    });
}