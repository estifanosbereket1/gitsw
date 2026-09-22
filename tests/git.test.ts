import { describe, it, expect } from "vitest";
import { parseGitHubRemote, parseRemoteAuth } from "../src/lib/git.js";

describe("parseGitHubRemote", () => {
  it("parses an aliased SSH remote", () => {
    expect(parseGitHubRemote("git@github.com-work:someorg/somerepo.git")).toEqual({
      org: "someorg",
      repo: "somerepo",
    });
  });

  it("parses a plain, unaliased SSH remote", () => {
    expect(parseGitHubRemote("git@github.com:someorg/somerepo.git")).toEqual({
      org: "someorg",
      repo: "somerepo",
    });
  });

  it("parses an HTTPS remote with an embedded username", () => {
    expect(parseGitHubRemote("https://myuser@github.com/someorg/somerepo.git")).toEqual({
      org: "someorg",
      repo: "somerepo",
    });
  });

  it("parses a remote with no .git suffix", () => {
    expect(parseGitHubRemote("git@github.com-work:someorg/somerepo")).toEqual({
      org: "someorg",
      repo: "somerepo",
    });
  });

  it("returns null for a non-GitHub remote", () => {
    expect(parseGitHubRemote("git@gitlab.com:someorg/somerepo.git")).toBeNull();
  });
});

describe("parseRemoteAuth", () => {
  it("identifies an aliased SSH host", () => {
    expect(parseRemoteAuth("git@github.com-work:org/repo.git")).toEqual({
      type: "ssh",
      hostAlias: "github.com-work",
    });
  });

  it("identifies an embedded HTTPS username", () => {
    expect(parseRemoteAuth("https://myuser@github.com/org/repo.git")).toEqual({
      type: "https",
      username: "myuser",
    });
  });

  it("returns null for a bare, unaliased HTTPS remote", () => {
    expect(parseRemoteAuth("https://github.com/org/repo.git")).toBeNull();
  });
});