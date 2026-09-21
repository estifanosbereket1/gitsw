import { promises as fs } from "node:fs";
import path from "node:path";
import { execa } from "execa";

const MARKER_START = "# >>> gitswitcher guard >>>";

export async function getHooksDir(cwd: string): Promise<string> {
  const { stdout } = await execa("git", ["rev-parse", "--git-path", "hooks"], { cwd });
  const dir = stdout.trim();
  return path.isAbsolute(dir) ? dir : path.join(cwd, dir);
}

function renderHookScript(): string {
  return [
    "#!/bin/sh",
    MARKER_START,
    "# Blocks commits when this repo's identity doesn't match its pinned profile.",
    "# Managed by gitsw — remove this block manually if you no longer want the check.",
    "if command -v gitsw >/dev/null 2>&1; then",
    "  gitsw guard-check",
    "  exit $?",
    "else",
    "  echo 'gitsw not found on PATH — skipping identity check.' >&2",
    "  exit 0",
    "fi",
    "# <<< gitswitcher guard <<<",
    "",
  ].join("\n");
}

export async function installGuardHook(
  cwd = process.cwd()
): Promise<"installed" | "already-installed" | "conflict"> {
  const hooksDir = await getHooksDir(cwd);
  await fs.mkdir(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, "pre-commit");

  let existing = "";
  try {
    existing = await fs.readFile(hookPath, "utf-8");
  } catch {
    // no existing hook — fine
  }

  if (existing.includes(MARKER_START)) return "already-installed";
  if (existing.trim().length > 0) return "conflict"; // don't clobber husky/lint-staged/etc.

  await fs.writeFile(hookPath, renderHookScript(), { mode: 0o755 });
  return "installed";
}