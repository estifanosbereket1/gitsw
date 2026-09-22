import { describe, it, expect } from "vitest";
import { buildHttpsRemoteUrl } from "../src/lib/https.js";

describe("buildHttpsRemoteUrl", () => {
  it("embeds the username ahead of the host", () => {
    expect(buildHttpsRemoteUrl("myuser", "someorg", "somerepo")).toBe(
      "https://myuser@github.com/someorg/somerepo.git"
    );
  });
});
