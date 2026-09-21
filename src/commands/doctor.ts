import type { Command } from "commander";
import chalk from "chalk";
import { findGitRepos } from "../lib/scan.js";
import { checkRepo } from "../lib/doctor.js";

export function registerDoctorCommand(program: Command): void {
    program
        .command("doctor [path]")
        .description("Scan a folder tree for repos with missing or mismatched account protection")
        .action(async (rawPath: string | undefined) => {
            const root = rawPath ?? process.cwd();
            console.log(chalk.dim(`Scanning ${root} ...\n`));

            const repos = await findGitRepos(root);
            if (repos.length === 0) {
                console.log(chalk.yellow("No git repositories found."));
                return;
            }

            let okCount = 0;
            let issueCount = 0;

            for (const repoPath of repos) {
                const result = await checkRepo(repoPath);
                switch (result.status) {
                    case "ok":
                        okCount++;
                        console.log(`${chalk.green("✔")} ${repoPath} — ${result.profile.alias}`);
                        break;
                    case "unguarded":
                        issueCount++;
                        console.log(`${chalk.yellow("!")} ${repoPath} — matches "${result.profile.alias}" but has no guard hook`);
                        console.log(chalk.dim(`    fix: cd ${repoPath} && gitsw pin ${result.profile.alias} --identity-only`));
                        break;
                    case "mismatch":
                        issueCount++;
                        console.log(
                            `${chalk.red("✖")} ${repoPath} — pinned to "${result.profile.alias}" (${result.profile.email}) ` +
                            `but active identity is ${result.effectiveEmail ?? "(none set)"}`
                        );
                        console.log(chalk.dim(`    fix: cd ${repoPath} && gitsw pin ${result.profile.alias}`));
                        break;
                    case "unknown-profile":
                        console.log(`${chalk.dim("·")} ${repoPath} — remote doesn't match any known gitsw profile`);
                        break;
                    case "unaliased":
                        console.log(`${chalk.dim("·")} ${repoPath} — unpinned remote (no account alias): ${result.remoteUrl}`);
                        break;
                    case "no-remote":
                        console.log(`${chalk.dim("·")} ${repoPath} — no "origin" remote yet`);
                        break;
                }
            }

            console.log(`\n${chalk.bold(`${okCount} OK`)}, ${issueCount} need attention, ${repos.length} repos scanned.`);
        });
}