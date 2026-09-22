import type { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { loadStore } from "../lib/store.js";
import {
  isInsideGitRepo,
  getRemoteUrl,
  setRemoteUrl,
  setLocalIdentity,
  parseGitHubRemote,
} from "../lib/git.js";
import { buildHttpsRemoteUrl } from "../lib/https.js";
import { installGuardHook } from "../lib/guard.js";
import { ok, fail, warn, dim } from "../lib/ui.js";

export function registerPinCommand(program: Command): void {
  program
    .command("pin <alias>")
    .description(
      "Lock the current repo to a profile (identity + remote), independent of global switches"
    )
    .option("-r, --remote <name>", "remote to rewrite", "origin")
    .option(
      "--identity-only",
      "only set local identity + guard hook; skip rewriting the remote URL"
    )
    .action(async (alias: string, opts: { remote: string; identityOnly?: boolean }) => {
      if (!(await isInsideGitRepo())) {
        fail("Not inside a git repository.");
        process.exitCode = 1;
        return;
      }

      const store = await loadStore();
      const profile = store.profiles.find((p) => p.alias === alias);
      if (!profile) {
        fail(`No profile named "${alias}". Run \`gitsw list\`.`);
        process.exitCode = 1;
        return;
      }

      if (!opts.identityOnly) {
        const currentUrl = await getRemoteUrl(opts.remote);
        if (!currentUrl) {
          fail(`No remote named "${opts.remote}" in this repo.`);
          process.exitCode = 1;
          return;
        }

        const parsed = parseGitHubRemote(currentUrl);
        if (!parsed) {
          fail(`Remote "${opts.remote}" doesn't look like a GitHub URL:\n  ${currentUrl}`);
          process.exitCode = 1;
          return;
        }

        let newUrl: string;
        if (profile.authType === "ssh") {
          if (!profile.ssh) {
            fail(`Profile "${alias}" is marked SSH but has no key on record.`);
            process.exitCode = 1;
            return;
          }
          newUrl = `git@${profile.ssh.hostAlias}:${parsed.org}/${parsed.repo}.git`;
        } else {
          if (!profile.https) {
            fail(`Profile "${alias}" is marked HTTPS but has no username on record.`);
            process.exitCode = 1;
            return;
          }
          newUrl = buildHttpsRemoteUrl(profile.https.username, parsed.org, parsed.repo);
        }

        if (newUrl === currentUrl) {
          dim(`Remote "${opts.remote}" is already pinned to "${alias}".`);
        } else {
          console.log(`Remote "${opts.remote}" will change:`);
          console.log(chalk.red(`  - ${currentUrl}`));
          console.log(chalk.green(`  + ${newUrl}`));

          const confirmed = await confirm({ message: "Apply this change?", default: true });
          if (!confirmed) {
            warn("Cancelled.");
            return;
          }
          await setRemoteUrl(opts.remote, newUrl);
        }
      } else {
        warn(
          "--identity-only: remote left untouched. Push-time credential selection isn't guaranteed correct — " +
            "if you have multiple HTTPS tokens for github.com, the wrong one could still be used."
        );
      }

      await setLocalIdentity(profile.name, profile.email);

      const guardResult = await installGuardHook();
      if (guardResult === "installed") {
        dim("  Installed a commit guard — future commits here are blocked if identity drifts.");
      } else if (guardResult === "conflict") {
        warn("  Note: an existing pre-commit hook is here — guard not auto-installed.");
        dim("  Add manually: gitsw guard-check || exit 1");
      }

      ok(`This repo is now pinned to "${alias}" (${profile.name} <${profile.email}>)`);
      dim(
        "  Local identity overrides your global one here, regardless of future `gitsw use` calls."
      );
    });
}
