import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findLatestUpgradeArtifactIn } from "../upgrade";

describe("upgrade transaction plan artifact discovery", () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "green-goods-upgrade-plan-"));
    fs.mkdirSync(path.join(temporaryDirectory, "dry-run"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("finds Foundry's signature-specific dry-run artifact", () => {
    const artifactPath = path.join(temporaryDirectory, "dry-run", "upgradeHatsModule-latest.json");
    fs.writeFileSync(artifactPath, "{}");

    expect(findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule()")).toBe(artifactPath);
  });

  it("retains compatibility with the legacy run-latest artifact", () => {
    const artifactPath = path.join(temporaryDirectory, "dry-run", "run-latest.json");
    fs.writeFileSync(artifactPath, "{}");

    expect(findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule()")).toBe(artifactPath);
  });

  it("fails closed for an invalid function signature", () => {
    expect(() => findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule")).toThrow(
      "Invalid upgrade function signature",
    );
  });
});
