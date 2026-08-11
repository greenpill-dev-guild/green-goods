import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

  it("selects a fresh legacy artifact over a stale signature-specific artifact", () => {
    const signatureArtifact = path.join(temporaryDirectory, "dry-run", "upgradeHatsModule-latest.json");
    const legacyArtifact = path.join(temporaryDirectory, "dry-run", "run-latest.json");
    fs.writeFileSync(signatureArtifact, "{}");
    fs.writeFileSync(legacyArtifact, "{}");
    fs.utimesSync(signatureArtifact, new Date(1_000), new Date(1_000));
    fs.utimesSync(legacyArtifact, new Date(2_000), new Date(2_000));

    expect(findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule()")).toBe(legacyArtifact);
  });

  it("fails closed for an invalid function signature", () => {
    expect(() => findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule")).toThrow(
      "Invalid upgrade function signature",
    );
  });
});

describe("upgrade operator entrypoint", () => {
  it("requires an explicit sender before a transaction plan can touch RPC", () => {
    const result = spawnSync(
      "bun",
      ["script/upgrade.ts", "assessment-resolver", "--network", "arbitrum", "--tx-plan"],
      { cwd: path.join(__dirname, "../.."), encoding: "utf8", env: process.env },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("--tx-plan requires an explicit --sender");
  });

  it("documents only Bun-wrapped rollback and upgrade commands", () => {
    const result = spawnSync("bun", ["script/upgrade.ts", "--help"], {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf8",
      env: process.env,
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toContain("bun run pooling:upgrade:dry:arbitrum");
    expect(output).not.toContain("forge script");
    expect(output).not.toContain("cast call");
  });

  it("will not enter a release-owned broadcast path without one reviewed plan boundary", () => {
    const result = spawnSync(
      "bun",
      [
        "script/upgrade.ts",
        "assessment-resolver",
        "--network",
        "arbitrum",
        "--broadcast",
        "--sender",
        "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6",
        "--expected-nonce",
        "899",
      ],
      { cwd: path.join(__dirname, "../.."), encoding: "utf8", env: process.env },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("requires --plan <path> and --step <index>");
  });
});
