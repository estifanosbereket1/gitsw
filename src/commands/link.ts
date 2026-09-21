import type { Command } from "commander";
import { loadStore } from "../lib/store.js";
import { linkFolder, unlinkFolder, listLinkedFolders } from "../lib/autolink.js";
import { makeTable, ok, fail, warn, dim } from "../lib/ui.js";

export function registerLinkCommands(program: Command): void {
    program
        .command("link <alias> <path>")
        .description("Auto-apply a profile's identity, SSH key, or credential to every repo under a folder")
        .action(async (alias: string, rawPath: string) => {
            const store = await loadStore();
            const profile = store.profiles.find((p) => p.alias === alias);
            if (!profile) {
                fail(`No profile named "${alias}". Run \`gitsw list\`.`);
                process.exitCode = 1;
                return;
            }

            const dir = await linkFolder(profile, rawPath);
            ok(`Linked "${alias}" to ${dir}`);
            dim("  Every repo under this folder now auto-uses this identity");
            if (profile.authType === "ssh") {
                dim("  and this SSH key — even on a fresh, unaliased clone, before you run `gitsw pin`.");
            } else {
                dim("  and this GitHub username for credential lookup — even before you run `gitsw pin`.");
            }
        });

    program
        .command("unlink <path>")
        .description("Remove a folder's auto-linked profile")
        .action(async (rawPath: string) => {
            const removed = await unlinkFolder(rawPath);
            if (removed) ok("Unlinked.");
            else warn("No link found for that path.");
        });

    program
        .command("links")
        .description("List all folder → profile links")
        .action(async () => {
            const entries = await listLinkedFolders();
            if (entries.length === 0) {
                warn("No folders linked yet. Run `gitsw link <alias> <path>`.");
                return;
            }
            const table = makeTable(["Folder", "Profile"]);
            for (const e of entries) table.push([e.dir, e.alias]);
            console.log(table.toString());
        });
}