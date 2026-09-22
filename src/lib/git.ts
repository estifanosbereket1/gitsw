import { execa } from "execa";

export async function isInsideGitRepo(cwd = process.cwd()): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function getRemoteUrl(remote: string, cwd = process.cwd()): Promise<string | null> {
  try {
    const { stdout } = await execa("git", ["remote", "get-url", remote], { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function setRemoteUrl(
  remote: string,
  url: string,
  cwd = process.cwd()
): Promise<void> {
  await execa("git", ["remote", "set-url", remote, url], { cwd });
}

export async function setLocalIdentity(
  name: string,
  email: string,
  cwd = process.cwd()
): Promise<void> {
  // Deliberately NOT --global — this writes to .git/config, which git
  // prioritizes over ~/.gitconfig for any command run inside this repo.
  await execa("git", ["config", "user.name", name], { cwd });
  await execa("git", ["config", "user.email", email], { cwd });
}

// Matches github.com or github.com-<alias>, over SSH or HTTPS, with or
// without a trailing .git — so it works on remotes we've already rewritten
// as well as untouched ones.
const GITHUB_REMOTE_REGEX = /github\.com(?:-[\w.-]+)?[:/]([^/]+)\/(.+?)(?:\.git)?$/;

export function parseGitHubRemote(url: string): { org: string; repo: string } | null {
  const match = url.match(GITHUB_REMOTE_REGEX);
  if (!match) return null;
  return { org: match[1], repo: match[2] };
}
export type RemoteAuth = { type: "ssh"; hostAlias: string } | { type: "https"; username: string };

// Only recognizes remotes with an explicit alias or embedded username —
// a bare git@github.com or https://github.com/... is intentionally
// ambiguous (could be any account) and returns null, meaning "skip".
export function parseRemoteAuth(url: string): RemoteAuth | null {
  const sshMatch = url.match(/^git@([\w.-]+):/);
  if (sshMatch) return { type: "ssh", hostAlias: sshMatch[1] };

  const httpsMatch = url.match(/^https:\/\/([^@/]+)@github\.com\//);
  if (httpsMatch) return { type: "https", username: httpsMatch[1] };

  return null;
}

export async function getEffectiveIdentity(
  cwd = process.cwd()
): Promise<{ name: string | null; email: string | null }> {
  const getConfig = async (key: string): Promise<string | null> => {
    try {
      const { stdout } = await execa("git", ["config", key], { cwd });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  };
  const [name, email] = await Promise.all([getConfig("user.name"), getConfig("user.email")]);
  return { name, email };
}
