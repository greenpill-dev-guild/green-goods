import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const ARBITRUM_ARTIFACT = path.join(CONTRACTS_ROOT, "deployments/42161-latest.json");
const CELO_ARTIFACT = path.join(CONTRACTS_ROOT, "deployments/42220-latest.json");

function run(args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync("bun", ["script/deploy.ts", ...args], {
    cwd: CONTRACTS_ROOT,
    encoding: "utf8",
    env,
  });
}

function fail(args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync("bun", ["script/deploy.ts", ...args], {
    cwd: CONTRACTS_ROOT,
    encoding: "utf8",
    env,
  });
}

describe("release CLI real entrypoints", () => {
  it("replays a pure stage plan with the exact CLI salt and never mutates canonical artifacts", () => {
    const arbitrumBefore = fs.readFileSync(ARBITRUM_ARTIFACT);
    const celoBefore = fs.readFileSync(CELO_ARTIFACT);
    const args = [
      "settlement-module",
      "--network",
      "arbitrum",
      "--pure-simulation",
      "--salt",
      "green-goods:test-entrypoint:v1",
    ];
    const first = run(args);
    const replay = run(args);
    expect(first).toContain('"baseSalt": "green-goods:test-entrypoint:v1"');
    expect(replay).toContain('"baseSalt": "green-goods:test-entrypoint:v1"');
    expect(fs.readFileSync(ARBITRUM_ARTIFACT).equals(arbitrumBefore)).toBe(true);
    expect(fs.readFileSync(CELO_ARTIFACT).equals(celoBefore)).toBe(true);
  });

  it("routes the pooling command through the selective release stage", () => {
    const output = run(["pooling", "--network", "arbitrum", "--pure-simulation"]);
    expect(output).toContain('"stage": "pooling"');
    expect(output).toContain("implementation:CommitmentPoolingModule");
    expect(output).toContain("set Assessment v3 schema UID");
  });

  it("fails closed for the wrong sender and unsupported Celo Sepolia target", () => {
    const wrongSender = fail([
      "credit-registry",
      "--network",
      "arbitrum",
      "--pure-simulation",
      "--sender",
      "0x0000000000000000000000000000000000000001",
    ]);
    expect(wrongSender.status).not.toBe(0);
    expect(`${wrongSender.stdout}${wrongSender.stderr}`).toContain("Wrong sender");

    const wrongNetwork = fail(["settlement-executor", "--network", "celo-sepolia", "--pure-simulation"]);
    expect(wrongNetwork.status).not.toBe(0);
    expect(`${wrongNetwork.stdout}${wrongNetwork.stderr}`).toContain("celo-sepolia is intentionally unsupported");
  });

  it("will not enter a broadcast path without one boundary and an exact nonce", () => {
    const noBoundary = fail(["settlement-module", "--network", "arbitrum", "--broadcast", "--override-sepolia-gate"]);
    expect(noBoundary.status).not.toBe(0);
    expect(`${noBoundary.stdout}${noBoundary.stderr}`).toContain("Broadcast requires --step");
  });

  it("ends the current core plan paused and blocks ownership broadcast before RPC", () => {
    const corePlan = run(["protocol-core", "--network", "arbitrum", "--pure-simulation"]);
    expect(corePlan).toContain('"operations": [');
    expect(corePlan).toContain('"ownership-transfer"');
    expect(corePlan).toContain('"18-garden-pool-backfill"');
    expect(corePlan).not.toContain('"command": "bun run release:ownership:plan:arbitrum"');
    expect(corePlan).not.toContain('"command": "bun run pooling:backfill:dry:arbitrum"');

    const transfer = fail([
      "ownership-transfer",
      "--network",
      "arbitrum",
      "--broadcast",
      "--step",
      "1",
      "--expected-nonce",
      "0",
      "--override-sepolia-gate",
    ]);
    expect(transfer.status).not.toBe(0);
    expect(`${transfer.stdout}${transfer.stderr}`).toContain("deferred to a later issue");
  });

  it("runs scoped recovery simulation through the real CLI without canonical mutation", () => {
    const canonicalBefore = fs.readFileSync(ARBITRUM_ARTIFACT);
    const output = run(["release-recover", "--network", "arbitrum", "--stage", "settlement-module", "--dry-run"]);
    expect(output).toContain("Recovery promotion simulation preserved canonical history");
    expect(fs.readFileSync(ARBITRUM_ARTIFACT).equals(canonicalBefore)).toBe(true);
  });

  it("refuses both peer plans until measured gas is frozen in the manifest", () => {
    const env = { ...process.env, SETTLEMENT_DESTINATION_GAS_LIMIT: "750000" };
    for (const network of ["arbitrum", "celo"]) {
      const result = fail(["settlement-peer", "--network", network, "--pure-simulation"], env);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("measured destination gas is frozen");
    }
  });

  it("rejects deployment-EOA peer plans after the ownership-transfer boundary", () => {
    const result = fail([
      "settlement-peer",
      "--network",
      "arbitrum",
      "--pure-simulation",
      "--sender",
      "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6",
    ]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Wrong sender");
  });
});
