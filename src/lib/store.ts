import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ProfileStore, Profile } from "../types.js";

const CONFIG_DIR = path.join(os.homedir(), ".gitswitcher");
const STORE_PATH = path.join(CONFIG_DIR, "profiles.json");

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

export async function loadStore(): Promise<ProfileStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as ProfileStore;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { activeAlias: null, profiles: [] };
    }
    throw err;
  }
}

export async function saveStore(store: ProfileStore): Promise<void> {
  await ensureConfigDir();
  const tmpPath = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmpPath, STORE_PATH); // atomic on the same filesystem
}

export async function addProfile(profile: Profile): Promise<void> {
  const store = await loadStore();
  if (store.profiles.some((p) => p.alias === profile.alias)) {
    throw new Error(`Profile "${profile.alias}" already exists.`);
  }
  store.profiles.push(profile);
  await saveStore(store);
}

export async function listProfiles(): Promise<Profile[]> {
  return (await loadStore()).profiles;
}

export async function removeProfile(alias: string): Promise<void> {
  const store = await loadStore();
  const next = store.profiles.filter((p) => p.alias !== alias);
  if (next.length === store.profiles.length) {
    throw new Error(`No profile named "${alias}".`);
  }
  store.profiles = next;
  if (store.activeAlias === alias) store.activeAlias = null;
  await saveStore(store);
}