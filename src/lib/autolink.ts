import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Profile } from "../types.js";

const GITCONFIG_PATH = path.join(os.homedir(), ".gitconfig");
const INCLUDES_DIR = path.join(os.homedir(), ".gitswitcher", "includes");

const MARKER_START = "# >>> gitswitcher managed includeIf >>>";
const MARKER_END = "# <<< gitswitcher managed includeIf <<<";

function normalizeDir(rawPath: string): string {
  const expanded = rawPath.startsWith("~") ? path.join(os.homedir(), rawPath.slice(1)) : rawPath;
  const abs = path.resolve(expanded);
  // Trailing slash matters: it's what tells git "this dir and everything
  // beneath it," matching includeIf's gitdir semantics.
  return abs.endsWith(path.sep) ? abs : abs + path.sep;
}

function snippetPath(alias: string): string {
  return path.join(INCLUDES_DIR, `${alias}.gitconfig`);
}

function renderSnippet(profile: Profile): string {
  const lines = [`[user]`, `  name = ${profile.name}`, `  email = ${profile.email}`];

  if (profile.authType === "ssh" && profile.ssh) {
    lines.push(`[core]`, `  sshCommand = ssh -i '${profile.ssh.keyPath}' -o IdentitiesOnly=yes`);
  } else if (profile.authType === "https" && profile.https) {
    lines.push(`[credential "https://github.com"]`, `  username = ${profile.https.username}`);
  }

  return lines.join("\n") + "\n";
}

async function writeSnippet(profile: Profile): Promise<string> {
  await fs.mkdir(INCLUDES_DIR, { recursive: true });
  const target = snippetPath(profile.alias);
  await fs.writeFile(target, renderSnippet(profile), "utf-8");
  return target;
}

interface ManagedInclude {
  dir: string;
  configPath: string;
}

// Same principle as the SSH config parser: we only ever parse text we
// wrote ourselves, between our own markers — never a user's hand-edited
// gitconfig content.
function parseManagedBlock(content: string): ManagedInclude[] {
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);
  if (start === -1 || end === -1) return [];
  const inner = content.slice(start + MARKER_START.length, end);
  const entries: ManagedInclude[] = [];
  const regex = /\[includeIf "gitdir:([^"]+)"\]\s*\n\s*path = (\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(inner)) !== null) {
    entries.push({ dir: match[1], configPath: match[2] });
  }
  return entries;
}

function renderManagedBlock(entries: ManagedInclude[]): string {
  const body = entries
    .map((e) => `[includeIf "gitdir:${e.dir}"]\n  path = ${e.configPath}`)
    .join("\n\n");
  return `${MARKER_START}\n# Do not edit by hand — managed by gitsw\n\n${body}\n\n${MARKER_END}`;
}

async function readGitConfig(): Promise<string> {
  try {
    return await fs.readFile(GITCONFIG_PATH, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

async function writeGitConfig(content: string): Promise<void> {
  try {
    await fs.access(GITCONFIG_PATH);
    await fs.copyFile(GITCONFIG_PATH, `${GITCONFIG_PATH}.bak`);
  } catch {
    // no existing file — nothing to back up
  }
  await fs.writeFile(GITCONFIG_PATH, content, "utf-8");
}

export async function linkFolder(profile: Profile, rawPath: string): Promise<string> {
  const dir = normalizeDir(rawPath);
  const configPath = await writeSnippet(profile);

  const content = await readGitConfig();
  const entries = parseManagedBlock(content);

  const idx = entries.findIndex((e) => e.dir === dir);
  if (idx >= 0) entries[idx] = { dir, configPath };
  else entries.push({ dir, configPath });

  const newBlock = renderManagedBlock(entries);
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);

  const newContent =
    start === -1 || end === -1
      ? `${content.trimEnd()}${content.trim() ? "\n\n" : ""}${newBlock}\n`
      : content.slice(0, start) + newBlock + content.slice(end + MARKER_END.length);

  await writeGitConfig(newContent);
  return dir;
}

export async function unlinkFolder(rawPath: string): Promise<boolean> {
  const dir = normalizeDir(rawPath);
  const content = await readGitConfig();
  const entries = parseManagedBlock(content);
  const next = entries.filter((e) => e.dir !== dir);
  if (next.length === entries.length) return false;

  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);
  if (start === -1 || end === -1) return false;

  const newContent =
    next.length === 0
      ? content.slice(0, start).trimEnd() + "\n" + content.slice(end + MARKER_END.length)
      : content.slice(0, start) + renderManagedBlock(next) + content.slice(end + MARKER_END.length);

  await writeGitConfig(newContent);
  return true;
}

export async function listLinkedFolders(): Promise<{ dir: string; alias: string }[]> {
  const entries = await parseManagedBlock(await readGitConfig());
  return entries.map((e) => ({ dir: e.dir, alias: path.basename(e.configPath, ".gitconfig") }));
}
