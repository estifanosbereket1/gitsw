export type AuthType = "ssh" | "https";

export interface SshAuth {
  keyPath: string;
  hostAlias: string;
}

export interface HttpsAuth {
  username: string;
}

export interface Profile {
  alias: string;
  name: string;
  email: string;
  authType: AuthType;
  ssh?: SshAuth;
  https?: HttpsAuth;
  autoPath?: string;
}

export interface ProfileStore {
  activeAlias: string | null;
  profiles: Profile[];
}
