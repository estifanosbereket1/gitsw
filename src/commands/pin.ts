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

export function registerPinCommand(program: Command): void {
    program
        .command("pin <alias>")
        .description("Lock the current repo to a profile (identity + remote), independent of global switches")
        .option("-r, --remote <name>", "remote to rewrite", "origin")
        .action(async (alias: string, opts: { remote: string }) => {
            if (!(await isInsideGitRepo())) {
                console.error(chalk.red("Not inside a git repository."));
                process.exitCode = 1;
                return;
            }

            const store = await loadStore();
            const profile = store.profiles.find((p) => p.alias === alias);
            if (!profile) {
                console.error(chalk.red(`No profile named "${alias}". Run \`gitsw list\`.`));
                process.exitCode = 1;
                return;
            }

            const currentUrl = await getRemoteUrl(opts.remote);
            if (!currentUrl) {
                console.error(chalk.red(`No remote named "${opts.remote}" in this repo.`));
                process.exitCode = 1;
                return;
            }

            const parsed = parseGitHubRemote(currentUrl);
            if (!parsed) {
                console.error(chalk.red(`Remote "${opts.remote}" doesn't look like a GitHub URL:\n  ${currentUrl}`));
                process.exitCode = 1;
                return;
            }

            let newUrl: string;
            if (profile.authType === "ssh") {
                if (!profile.ssh) {
                    console.error(chalk.red(`Profile "${alias}" is marked SSH but has no key on record.`));
                    process.exitCode = 1;
                    return;
                }
                newUrl = `git@${profile.ssh.hostAlias}:${parsed.org}/${parsed.repo}.git`;
            } else {
                if (!profile.https) {
                    console.error(chalk.red(`Profile "${alias}" is marked HTTPS but has no username on record.`));
                    process.exitCode = 1;
                    return;
                }
                newUrl = buildHttpsRemoteUrl(profile.https.username, parsed.org, parsed.repo);
            }

            if (newUrl === currentUrl) {
                console.log(chalk.dim(`Remote "${opts.remote}" is already pinned to "${alias}".`));
            } else {
                console.log(`Remote "${opts.remote}" will change:`);
                console.log(chalk.red(`  - ${currentUrl}`));
                console.log(chalk.green(`  + ${newUrl}`));

                const ok = await confirm({ message: "Apply this change?", default: true });
                if (!ok) {
                    console.log(chalk.yellow("Cancelled."));
                    return;
                }
                await setRemoteUrl(opts.remote, newUrl);
            }

            await setLocalIdentity(profile.name, profile.email);

            console.log(chalk.green(`✔ This repo is now pinned to "${alias}" (${profile.name} <${profile.email}>)`));
            const guardResult = await installGuardHook();
            if (guardResult === "installed") {
                console.log(chalk.dim("  Installed a commit guard — future commits here are blocked if identity drifts."));
            } else if (guardResult === "conflict") {
                console.log(chalk.yellow("  Note: an existing pre-commit hook is here — guard not auto-installed."));
                console.log(chalk.dim("  Add manually: gitsw guard-check || exit 1"));
            }
            console.log(chalk.dim("  Local identity overrides your global one here, regardless of future `gitsw use` calls."));
        });
}