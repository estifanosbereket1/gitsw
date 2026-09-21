import type { Command } from "commander";
import chalk from "chalk";
import { loadStore } from "../lib/store.js";
import { getRemoteUrl, parseRemoteAuth, getEffectiveIdentity, isInsideGitRepo } from "../lib/git.js";
import { installGuardHook } from "../lib/guard.js";
import { ok, fail, warn, dim } from "../lib/ui.js";

export function registerGuardCommands(program: Command): void {
    program
        .command("guard-check")
        .description("Internal: called by the pre-commit hook, not meant to be run directly")
        .action(async () => {
            if (!(await isInsideGitRepo())) process.exit(0);

            const url = await getRemoteUrl("origin");
            if (!url) process.exit(0);

            const remoteAuth = parseRemoteAuth(url);
            if (!remoteAuth) process.exit(0);

            const store = await loadStore();
            const profile = store.profiles.find((p) =>
                remoteAuth.type === "ssh"
                    ? p.ssh?.hostAlias === remoteAuth.hostAlias
                    : p.https?.username === remoteAuth.username
            );
            if (!profile) process.exit(0);

            const identity = await getEffectiveIdentity();
            if (identity.email === profile.email) process.exit(0);

            console.error(chalk.red(`\n✖ Commit blocked: this repo is pinned to "${profile.alias}" (${profile.email}),`));
            console.error(chalk.red(`  but the active commit identity is "${identity.email ?? "(none set)"}".`));
            console.error(chalk.dim(`\n  Fix with: gitsw pin ${profile.alias}\n`));
            process.exit(1);
        });

    const guardCmd = program.command("guard").description("Manage the commit-time identity guard for this repo");

    guardCmd
        .command("install")
        .description("Install a pre-commit hook that blocks commits under the wrong identity")
        .action(async () => {
            if (!(await isInsideGitRepo())) {
                fail("Not inside a git repository.");
                process.exitCode = 1;
                return;
            }
            const result = await installGuardHook();
            if (result === "installed") {
                ok("Guard hook installed at .git/hooks/pre-commit");
            } else if (result === "already-installed") {
                dim("Guard hook already installed.");
            } else {
                warn("An existing pre-commit hook is already here — not overwritten.");
                dim("Add this line inside it manually: gitsw guard-check || exit 1");
            }
        });
}