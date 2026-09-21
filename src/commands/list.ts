import type { Command } from "commander";
import { listProfiles } from "../lib/store.js";
import { makeTable, warn } from "../lib/ui.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List saved GitHub account profiles")
    .action(async () => {
      const profiles = await listProfiles();
      if (profiles.length === 0) {
        warn("No profiles yet. Run `gitsw add` to create one.");
        return;
      }

      const table = makeTable(["Alias", "Name", "Email", "Auth"]);
      for (const p of profiles) table.push([p.alias, p.name, p.email, p.authType]);
      console.log(table.toString());
    });
}