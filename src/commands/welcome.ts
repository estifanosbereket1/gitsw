import type { Command } from "commander";
import chalk from "chalk";
import { loadStore } from "../lib/store.js";
import { isInsideGitRepo } from "../lib/git.js";
import { checkRepo } from "../lib/doctor.js";
import { listLinkedFolders } from "../lib/autolink.js";
import { box, dim } from "../lib/ui.js";

function statusLine(result: Awaited<ReturnType<typeof checkRepo>>): string {
    switch (result.status) {
        case "ok":
            return chalk.green(`✔ this repo is safely pinned to "${result.profile.alias}"`);
        case "mismatch":
            return chalk.red(`✖ identity mismatch — pinned to "${result.profile.alias}", run \`gitsw doctor\` for details`);
        case "unguarded":
            return chalk.yellow(`! matches "${result.profile.alias}" but has no commit guard — run \`gitsw pin ${result.profile.alias} --identity-only\``);
        case "unaliased":
            return chalk.dim("this repo's remote isn't pinned to any profile yet");
        case "unknown-profile":
            return chalk.dim("this repo doesn't match any known gitsw profile");
        case "no-remote":
            return chalk.dim("this repo has no remote yet");
    }
}

export function registerWelcomeAction(program: Command): void {
    program.action(async () => {
        const store = await loadStore();
        const active = store.profiles.find((p) => p.alias === store.activeAlias);
        const links = await listLinkedFolders();

        const lines: string[] = [];

        lines.push(
            active
                ? chalk.bold(`Active: ${active.alias}`) + chalk.dim(` — ${active.name} <${active.email}> (${active.authType})`)
                : chalk.yellow("No active profile — run `gitsw use <alias>`")
        );

        if (await isInsideGitRepo()) {
            const result = await checkRepo(process.cwd());
            lines.push("");
            lines.push(statusLine(result));
        }

        lines.push("");
        lines.push(chalk.dim(`${store.profiles.length} profile(s) · ${links.length} folder(s) linked`));

        box(lines.join("\n"), "gitsw");

        dim("  add · list · use <alias> · current · pin <alias> · link <alias> <path> · doctor · --help");
    });
}