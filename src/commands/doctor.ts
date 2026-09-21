import type { Command } from "commander";
import { findGitRepos } from "../lib/scan.js";
import { checkRepo } from "../lib/doctor.js";
import { ok, warn, fail, dim, heading, spinner } from "../lib/ui.js";

export function registerDoctorCommand(program: Command): void {
    program
        .command("doctor [path]")
        .description("Scan a folder tree for repos with missing or mismatched account protection")
        .action(async (rawPath: string | undefined) => {
            const root = rawPath ?? process.cwd();

            const spin = spinner(`Scanning ${root} ...`);
            const repos = await findGitRepos(root);
            spin.stop();

            if (repos.length === 0) {
                warn("No git repositories found.");
                return;
            }

            let okCount = 0;
            let issueCount = 0;

            for (const repoPath of repos) {
                const result = await checkRepo(repoPath);
                switch (result.status) {
                    case "ok":
                        okCount++;
                        ok(`${repoPath} — ${result.profile.alias}`);
                        break;
                    case "unguarded":
                        issueCount++;
                        warn(`${repoPath} — matches "${result.profile.alias}" but has no guard hook`);
                        dim(`    fix: cd ${repoPath} && gitsw pin ${result.profile.alias} --identity-only`);
                        break;
                    case "mismatch":
                        issueCount++;
                        fail(
                            `${repoPath} — pinned to "${result.profile.alias}" (${result.profile.email}) ` +
                            `but active identity is ${result.effectiveEmail ?? "(none set)"}`
                        );
                        dim(`    fix: cd ${repoPath} && gitsw pin ${result.profile.alias}`);
                        break;
                    case "unknown-profile":
                        dim(`· ${repoPath} — remote doesn't match any known gitsw profile`);
                        break;
                    case "unaliased":
                        dim(`· ${repoPath} — unpinned remote (no account alias): ${result.remoteUrl}`);
                        break;
                    case "no-remote":
                        dim(`· ${repoPath} — no "origin" remote yet`);
                        break;
                }
            }

            heading(`\n${okCount} OK, ${issueCount} need attention, ${repos.length} repos scanned.`);
        });
}