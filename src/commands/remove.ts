import type { Command } from "commander";
import { loadStore, removeProfile } from "../lib/store.js";
import { rejectCredential } from "../lib/https.js";
import { ok, fail } from "../lib/ui.js";

export function registerRemoveCommand(program: Command): void {
  program
    .command("remove <alias>")
    .description("Remove a saved profile")
    .action(async (alias: string) => {
      const store = await loadStore();
      const profile = store.profiles.find((p) => p.alias === alias);
      if (!profile) {
        fail(`No profile named "${alias}".`);
        process.exitCode = 1;
        return;
      }

      await removeProfile(alias);

      if (profile.authType === "https" && profile.https) {
        await rejectCredential(profile.https.username);
      }

      ok(`Removed profile "${alias}"`);
    });
}
