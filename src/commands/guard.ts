import type { Command } from "commander";
import chalk from "chalk";
import { loadStore } from "../lib/store.js";
import { getRemoteUrl, parseRemoteAuth, getEffectiveIdentity, isInsideGitRepo } from "../lib/git.js";
import { installGuardHook } from "../lib/guard.js";

export function registerGuardCommands(program: Command): void {
  program
    .command("guard-check")
    .description("Internal: called by the pre-commit hook, not meant to be run directly")
    .action(async () => {
      if (!(await isInsideGitRepo())) process.exit(0);

      const url = await getRemoteUrl("origin");
      if (!url) process.exit(0); // no remote yet — nothing to guard

      const remoteAuth = parseRemoteAuth(url);
      if (!remoteAuth) process.exit(0); // unaliased remote — can't attribute, allow

      const store = await loadStore();
      const profile = store.profiles.find((p) =>
        remoteAuth.type === "ssh"
          ? p.ssh?.hostAlias === remoteAuth.hostAlias
          : p.https?.username === remoteAuth.username
      );
      if (!profile) process.exit(0); // remote isn't one of our known profiles — allow

      const identity = await getEffectiveIdentity();
      if (identity.email === profile.email) process.exit(0); // matches — allow

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
        console.error(chalk.red("Not inside a git repository."));
        process.exitCode = 1;
        return;
      }
      const result = await installGuardHook();
      if (result === "installed") {
        console.log(chalk.green("✔ Guard hook installed at .git/hooks/pre-commit"));
      } else if (result === "already-installed") {
        console.log(chalk.dim("Guard hook already installed."));
      } else {
        console.log(chalk.yellow("An existing pre-commit hook is already here — not overwritten."));
        console.log(chalk.dim("Add this line inside it manually: gitsw guard-check || exit 1"));
      }
    });
}