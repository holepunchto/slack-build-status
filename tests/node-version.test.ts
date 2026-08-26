import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error - plain ESM tooling script, no types
import { actionManifests, nodeVersion } from "../scripts/sync-node-version.mjs";

describe("node runtime", () => {
  it("finds every action manifest", () => {
    expect(actionManifests().sort()).toEqual([
      "cancel-all/action.yml",
      "create/action.yml",
      "update/action.yml",
      "upload/action.yml",
    ]);
  });

  it("declares the same runtime everywhere, and it is the one in .node-version", () => {
    const expected = nodeVersion();
    for (const path of actionManifests()) {
      const using = readFileSync(path, "utf8").match(/^\s*using:\s*(\S+)\s*$/m)?.[1];
      expect(`${path}: ${using}`).toBe(`${path}: ${expected}`);
    }
  });

  it("keeps .node-version to a bare major, which is what `using` accepts", () => {
    expect(readFileSync(".node-version", "utf8").trim()).toMatch(/^\d+$/);
  });
});
