import { execa } from "execa";

// Without this, `git credential fill` silently blocks waiting for a tty
// prompt whenever no helper is configured — exactly what you just hit
// running it by hand. Forcing this off makes every git-credential call
// here fail fast instead of hanging, in every context.
const GIT_ENV = { GIT_TERMINAL_PROMPT: "0" };

export async function getCredentialHelpers(): Promise<string[]> {
  try {
    const { stdout } = await execa("git", ["config", "--get-all", "credential.helper"]);
    return stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function configureCredentialStore(): Promise<void> {
  await execa("git", ["config", "--global", "credential.helper", "store"]);
}

export async function approveCredential(username: string, token: string): Promise<void> {
  const input = `protocol=https\nhost=github.com\nusername=${username}\npassword=${token}\n\n`;
  await execa("git", ["credential", "approve"], { input, env: GIT_ENV });
}

export async function rejectCredential(username: string): Promise<void> {
  const input = `protocol=https\nhost=github.com\nusername=${username}\n\n`;
  await execa("git", ["credential", "reject"], { input, reject: false, env: GIT_ENV });
}

async function fillCredential(username: string): Promise<string | null> {
  const input = `protocol=https\nhost=github.com\nusername=${username}\n\n`;
  const { stdout } = await execa("git", ["credential", "fill"], { input, reject: false, env: GIT_ENV });
  const match = stdout.match(/password=(.+)/);
  return match ? match[1].trim() : null;
}

export async function verifyGitHubIdentityHttps(
  username: string
): Promise<{ ok: boolean; login?: string; reason?: string }> {
  const token = await fillCredential(username);
  if (!token) {
    return { ok: false, reason: "No stored token found for this username." };
  }

  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "gitswitcher-cli" },
  });

  if (!res.ok) {
    return { ok: false, reason: `GitHub rejected the token (HTTP ${res.status}).` };
  }

  const data = (await res.json()) as { login: string };
  return { ok: true, login: data.login };
}

export function buildHttpsRemoteUrl(username: string, org: string, repo: string): string {
  return `https://${username}@github.com/${org}/${repo}.git`;
}