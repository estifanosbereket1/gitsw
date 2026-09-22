import type { Command } from "commander";
import { select } from "@inquirer/prompts";
import { loadStore, saveStore } from "../lib/store.js";
import { upsertHostAlias } from "../lib/ssh.js";
import { execa } from "execa";
import { ok, fail, dim, spinner } from "../lib/ui.js";

export function registerUseCommand(program: Command): void {
  program
    .command("use [alias]")
    .description("Switch the global default GitHub identity")
    .action(async (aliasArg?: string) => {
      const store = await loadStore();

      if (store.profiles.length === 0) {
        fail("No profiles yet. Run `gitsw add` to create one.");
        process.exitCode = 1;
        return;
      }

      let alias = aliasArg;
      if (!alias) {
        alias = await select({
          message: "Switch to which profile?",
          choices: store.profiles.map((p) => ({
            name: `${p.alias} — ${p.name} <${p.email}> (${p.authType})${p.alias === store.activeAlias ? "  (current)" : ""}`,
            value: p.alias,
          })),
        });
      }

      const profile = store.profiles.find((p) => p.alias === alias);
      if (!profile) {
        fail(`No profile named "${alias}". Run \`gitsw list\`.`);
        process.exitCode = 1;
        return;
      }

      const spin = spinner(`Switching to "${alias}"...`);

      await execa("git", ["config", "--global", "user.name", profile.name]);
      await execa("git", ["config", "--global", "user.email", profile.email]);

      if (profile.authType === "ssh") {
        if (!profile.ssh) {
          spin.stop();
          fail(`Profile "${alias}" is marked SSH but has no key on record.`);
          dim(`  Fix: gitsw remove ${alias} && gitsw add`);
          process.exitCode = 1;
          return;
        }
        await upsertHostAlias("github.com", profile.ssh.keyPath);
      }

      store.activeAlias = alias;
      await saveStore(store);

      spin.stop();
      ok(`Switched to "${alias}" (${profile.name} <${profile.email}>)`);

      if (profile.authType === "ssh") {
        dim("  Default SSH identity updated for unaliased git@github.com remotes.");
      } else {
        dim(
          "  HTTPS profile — identity set globally, but auth is per-repo. Run `gitsw pin` in a repo to bind its remote + credential to this account."
        );
      }
    });
}
