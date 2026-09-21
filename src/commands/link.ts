import type { Command } from "commander";
import chalk from "chalk";
import { loadStore } from "../lib/store.js";
import { linkFolder, unlinkFolder, listLinkedFolders } from "../lib/autolink.js";
import { makeTable, warn } from "../lib/ui.js";

export function registerLinkCommands(program: Command): void {
    program
        .command("link <alias> <path>")
        .description("Auto-apply a profile's identity, SSH key, or credential to every repo under a folder")
        .action(async (alias: string, rawPath: string) => {
            const store = await loadStore();
            const profile = store.profiles.find((p) => p.alias === alias);
            if (!profile) {
                console.error(chalk.red(`No profile named "${alias}". Run \`gitsw list\`.`));
                process.exitCode = 1;
                return;
            }

            const dir = await linkFolder(profile, rawPath);
            console.log(chalk.green(`✔ Linked "${alias}" to ${dir}`));
            console.log(chalk.dim("  Every repo under this folder now auto-uses this identity"));
            if (profile.authType === "ssh") {
                console.log(chalk.dim("  and this SSH key — even on a fresh, unaliased clone, before you run `gitsw pin`."));
            } else {
                console.log(chalk.dim("  and this GitHub username for credential lookup — even before you run `gitsw pin`."));
            }
        });

    program
        .command("unlink <path>")
        .description("Remove a folder's auto-linked profile")
        .action(async (rawPath: string) => {
            const removed = await unlinkFolder(rawPath);
            console.log(removed ? chalk.green("✔ Unlinked.") : chalk.yellow("No link found for that path."));
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