import { promises as fs } from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "vendor"]);

export async function findGitRepos(root: string, maxDepth = 6): Promise<string[]> {
  const repos: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // permission denied, broken symlink, etc — skip quietly, don't crash the whole scan
    }

    const isRepo = entries.some((e) => e.isDirectory() && e.name === ".git");
    if (isRepo) {
      repos.push(dir);
      return; // don't scan inside a repo for nested repos — keeps output to real project roots
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  await walk(path.resolve(root), 0);
  return repos;
}
