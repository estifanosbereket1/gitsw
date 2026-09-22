import type { Command } from "commander";
import chalk from "chalk";
import { loadStore } from "../lib/store.js";
import { verifyGitHubIdentity } from "../lib/ssh.js";
import { verifyGitHubIdentityHttps } from "../lib/https.js";
import { ok, fail, warn, dim, spinner } from "../lib/ui.js";

export function registerCurrentCommand(program: Command): void {
  program
    .command("current")
    .alias("whoami")
    .description("Show the active profile and verify it against GitHub")
    .action(async () => {
      const store = await loadStore();
      if (!store.activeAlias) {
        warn("No active profile. Run `gitsw use <alias>`.");
        return;
      }

      const profile = store.profiles.find((p) => p.alias === store.activeAlias);
      if (!profile) {
        fail("Active alias points to a profile that no longer exists.");
        return;
      }

      console.log(
        `${chalk.bold("Declared:")} ${profile.alias} — ${profile.name} <${profile.email}>`
      );

      if (profile.authType === "ssh") {
        const spin = spinner("Verifying via SSH...");
        const result = await verifyGitHubIdentity("github.com");
        spin.stop();

        if (result.ok) {
          ok(`Verified via SSH: Hi ${result.username}!`);
        } else {
          fail("Could not verify via SSH — is the public key added to GitHub yet?");
          dim(result.raw);
        }
      } else if (profile.https) {
        const spin = spinner("Verifying via API...");
        const result = await verifyGitHubIdentityHttps(profile.https.username);
        spin.stop();

        if (result.ok) {
          ok(`Verified via API: Hi ${result.login}!`);
        } else {
          fail(`Could not verify: ${result.reason}`);
        }
      } else {
        fail("Profile is marked HTTPS but has no username on record.");
      }
    });
}
