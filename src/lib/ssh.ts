import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";

const SSH_DIR = path.join(os.homedir(), ".ssh");
const SSH_CONFIG_PATH = path.join(SSH_DIR, "config");

const MARKER_START = "# >>> gitswitcher managed block >>>";
const MARKER_END = "# <<< gitswitcher managed block <<<";

async function keyExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function generateSshKey(alias: string, email: string): Promise<string> {
  await fs.mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
  const keyPath = path.join(SSH_DIR, `id_ed25519_${alias}`);

  if (await keyExists(keyPath)) {
    throw new Error(`SSH key already exists at ${keyPath}`);
  }

  await execa("ssh-keygen", ["-t", "ed25519", "-f", keyPath, "-C", email, "-N", ""]);
  return keyPath;
}

function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

export async function importSshKey(rawPath: string): Promise<string> {
  const keyPath = expandHome(rawPath.trim());

  if (!(await keyExists(keyPath))) {
    throw new Error(`No private key found at ${keyPath}`);
  }
  if (!(await keyExists(`${keyPath}.pub`))) {
    throw new Error(`Found ${keyPath} but no matching ${keyPath}.pub — is this a valid key pair?`);
  }
  return keyPath;
}

interface ManagedHost {
  hostAlias: string;
  keyPath: string;
}

function renderHostBlock({ hostAlias, keyPath }: ManagedHost): string {
  return [
    `Host ${hostAlias}`,
    `  HostName github.com`,
    `  User git`,
    `  IdentityFile ${keyPath}`,
    `  IdentitiesOnly yes`,
  ].join("\n");
}

// We only ever parse text that WE wrote, between our own markers — that's
// what makes a regex-based parse safe here. Never do this against a user's
// full, hand-edited ssh config.
function parseManagedBlock(content: string): ManagedHost[] {
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);
  if (start === -1 || end === -1) return [];

  const inner = content.slice(start + MARKER_START.length, end);
  const hosts: ManagedHost[] = [];
  const hostRegex = /Host (\S+)\s+HostName github\.com\s+User git\s+IdentityFile (\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = hostRegex.exec(inner)) !== null) {
    hosts.push({ hostAlias: match[1], keyPath: match[2] });
  }
  return hosts;
}

function renderManagedBlock(hosts: ManagedHost[]): string {
  const body = hosts.map(renderHostBlock).join("\n\n");
  return `${MARKER_START}\n# Do not edit by hand — managed by gitsw\n\n${body}\n\n${MARKER_END}`;
}

async function readSshConfig(): Promise<string> {
  try {
    return await fs.readFile(SSH_CONFIG_PATH, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

async function writeSshConfig(content: string): Promise<void> {
  await fs.mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
  if (await keyExists(SSH_CONFIG_PATH)) {
    await fs.copyFile(SSH_CONFIG_PATH, `${SSH_CONFIG_PATH}.bak`);
  }
  await fs.writeFile(SSH_CONFIG_PATH, content, { mode: 0o600 });
}

export async function upsertHostAlias(hostAlias: string, keyPath: string): Promise<void> {
  const content = await readSshConfig();
  const hosts = parseManagedBlock(content);

  const idx = hosts.findIndex((h) => h.hostAlias === hostAlias);
  if (idx >= 0) hosts[idx] = { hostAlias, keyPath };
  else hosts.push({ hostAlias, keyPath });

  const newBlock = renderManagedBlock(hosts);
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);

  const newContent =
    start === -1 || end === -1
      ? `${content.trimEnd()}${content.trim() ? "\n\n" : ""}${newBlock}\n`
      : content.slice(0, start) + newBlock + content.slice(end + MARKER_END.length);

  await writeSshConfig(newContent);
}

export async function verifyGitHubIdentity(
  hostAlias: string
): Promise<{ ok: boolean; username?: string; raw: string }> {
  const { stderr } = await execa("ssh", ["-T", `git@${hostAlias}`], { reject: false });
  const match = stderr.match(/Hi (\S+)!/);
  if (match) return { ok: true, username: match[1], raw: stderr };
  return { ok: false, raw: stderr };
}