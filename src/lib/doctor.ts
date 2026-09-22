import path from "node:path";
import { promises as fs } from "node:fs";
import { getRemoteUrl, parseRemoteAuth, getEffectiveIdentity } from "./git.js";
import { getHooksDir } from "./guard.js";
import { loadStore } from "./store.js";
import type { Profile } from "../types.js";

export type RepoStatus =
  | { status: "no-remote"; repoPath: string }
  | { status: "unaliased"; repoPath: string; remoteUrl: string }
  | { status: "unknown-profile"; repoPath: string; remoteUrl: string }
  | { status: "mismatch"; repoPath: string; profile: Profile; effectiveEmail: string | null }
  | { status: "unguarded"; repoPath: string; profile: Profile }
  | { status: "ok"; repoPath: string; profile: Profile };

async function hasGuardHook(repoPath: string): Promise<boolean> {
  try {
    const hookPath = path.join(await getHooksDir(repoPath), "pre-commit");
    const content = await fs.readFile(hookPath, "utf-8");
    return content.includes("gitswitcher guard");
  } catch {
    return false;
  }
}

export async function checkRepo(repoPath: string): Promise<RepoStatus> {
  const url = await getRemoteUrl("origin", repoPath);
  if (!url) return { status: "no-remote", repoPath };

  const remoteAuth = parseRemoteAuth(url);
  if (!remoteAuth) return { status: "unaliased", repoPath, remoteUrl: url };

  const store = await loadStore();
  const profile = store.profiles.find((p) =>
    remoteAuth.type === "ssh"
      ? p.ssh?.hostAlias === remoteAuth.hostAlias
      : p.https?.username === remoteAuth.username
  );
  if (!profile) return { status: "unknown-profile", repoPath, remoteUrl: url };

  const identity = await getEffectiveIdentity(repoPath);
  if (identity.email !== profile.email) {
    return { status: "mismatch", repoPath, profile, effectiveEmail: identity.email };
  }

  if (!(await hasGuardHook(repoPath))) return { status: "unguarded", repoPath, profile };

  return { status: "ok", repoPath, profile };
}
