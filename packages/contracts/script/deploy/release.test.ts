import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type OwnershipCheckpoint,
  type OwnershipTransferPlan,
  type ReleaseCheckpoint,
  retryPostStateVerification,
  validateOwnershipCheckpointPrefix,
  validateReleaseCheckpointPrefix,
} from "./release";
import { retryRpcAvailability } from "../utils/rpc-retry";
import { parseCastTransactionHash } from "../utils/cast-env";
import { buildReleaseLock, loadReleaseManifest } from "../utils/release-manifest";
import type { ReleaseTransactionBoundary } from "../utils/release-plan";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const ARBITRUM_ARTIFACT = path.join(CONTRACTS_ROOT, "deployments/42161-latest.json");
const CELO_ARTIFACT = path.join(CONTRACTS_ROOT, "deployments/42220-latest.json");
const TRANSACTION_HASH = `0x${"a".repeat(64)}`;

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
  it("retries unavailable RPC evidence without repeating the transaction", async () => {
    let reads = 0;
    let waits = 0;

    const result = await retryRpcAvailability(
      async () => {
        reads += 1;
        return reads === 3 ? "mined" : undefined;
      },
      { attempts: 4, wait: async () => void (waits += 1) },
    );

    expect(result).toBe("mined");
    expect(reads).toBe(3);
    expect(waits).toBe(2);
  });

  it("fails closed when RPC evidence remains unavailable", async () => {
    let reads = 0;
    let waits = 0;

    await expect(
      retryRpcAvailability(
        async () => {
          reads += 1;
          return undefined;
        },
        {
          attempts: 3,
          wait: async () => void (waits += 1),
          unavailableMessage: "receipt unavailable",
        },
      ),
    ).rejects.toThrow("receipt unavailable");
    expect(reads).toBe(3);
    expect(waits).toBe(2);
  });

  it("retries transient post-state reads without repeating the transaction", () => {
    let verificationAttempts = 0;
    let waits = 0;

    retryPostStateVerification(
      () => {
        verificationAttempts += 1;
        if (verificationAttempts < 3) throw new Error("RPC has not propagated");
      },
      { attempts: 4, wait: () => (waits += 1) },
    );

    expect(verificationAttempts).toBe(3);
    expect(waits).toBe(2);
  });

  it("fails closed after the bounded post-state retry window", () => {
    let verificationAttempts = 0;
    let waits = 0;

    expect(() =>
      retryPostStateVerification(
        () => {
          verificationAttempts += 1;
          throw new Error("post-state remains unreadable");
        },
        { attempts: 3, wait: () => (waits += 1) },
      ),
    ).toThrow("post-state remains unreadable");
    expect(verificationAttempts).toBe(3);
    expect(waits).toBe(2);
  });

  it("keeps every frozen CREATE2 identity executable by the release script", () => {
    const source = fs.readFileSync(path.join(CONTRACTS_ROOT, "script/DeployCommitmentRelease.s.sol"), "utf8");
    const executableLabels = new Set(
      [...source.matchAll(/_deploy\([\s\S]*?,\s*"((?:library|implementation|proxy):[^"]+)"\s*\)/gu)].map(
        (match) => match[1],
      ),
    );
    const frozenLabels = buildReleaseLock(loadReleaseManifest()).identities.map(
      (identity) => `${identity.kind}:${identity.name}`,
    );

    expect([...frozenLabels].filter((label) => !executableLabels.has(label))).toEqual([]);
  });

  it("accepts Cast transaction hashes from JSON receipts and single-quoted RPC output", () => {
    expect(parseCastTransactionHash(JSON.stringify({ transactionHash: TRANSACTION_HASH }), "test boundary")).toBe(
      TRANSACTION_HASH,
    );
    expect(parseCastTransactionHash(`'${TRANSACTION_HASH}'`, "test boundary")).toBe(TRANSACTION_HASH);
    expect(() => parseCastTransactionHash(`${TRANSACTION_HASH} ${`0x${"b".repeat(64)}`}`, "test boundary")).toThrow(
      /no unique transaction hash/,
    );
  });

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
    expect(corePlan.indexOf('"ownership-transfer"')).toBeLessThan(corePlan.indexOf('"18-garden-pool-backfill"'));
    expect(corePlan.indexOf('"18-garden-pool-backfill"')).toBeLessThan(corePlan.indexOf('"core-unpause"'));
    expect(corePlan).toContain("backfill while the module remains paused");
    expect(corePlan).toContain("separate later unpause authorization");
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

describe("release boundary checkpoint integrity", () => {
  const transactionHash = (suffix: string) => `0x${suffix.padStart(64, "0")}`;
  const verifiedAt = "2026-08-12T12:00:00.000Z";

  it("rejects a release checkpoint that omits any earlier receipt boundary", () => {
    const transactions = [1, 2, 3].map(
      (index): ReleaseTransactionBoundary => ({
        index,
        stage: "pooling",
        kind: "configuration",
        label: `boundary ${index}`,
        network: "arbitrum",
        sender: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        preconditions: [],
        resumableState: "reviewed",
        postActionVerifier: [],
      }),
    );
    const checkpoint: ReleaseCheckpoint = {
      schemaVersion: 1,
      releaseId: "release",
      manifestHash: transactionHash("a"),
      stage: "pooling",
      network: "arbitrum",
      baseSalt: "salt",
      lastVerifiedStep: 1,
      verifiedBoundaries: [
        {
          index: 2,
          label: "boundary 2",
          expectedNonce: 11,
          transactionHash: transactionHash("2"),
          blockNumber: 2,
          verifiedAt,
        },
      ],
    };

    expect(() => validateReleaseCheckpointPrefix(checkpoint, transactions, 3)).toThrow(
      "not the next boundary in the verified prefix",
    );
  });

  it("rejects an ownership checkpoint that contains only the immediately prior boundary", () => {
    const plan: OwnershipTransferPlan = {
      schemaVersion: 1,
      releaseId: "release",
      manifestHash: transactionHash("a"),
      sourceCommit: "a".repeat(40),
      network: "arbitrum",
      chainId: 42161,
      sender: "0x0000000000000000000000000000000000000001",
      finalOwner: "0x0000000000000000000000000000000000000002",
      transactions: [1, 2, 3].map((index) => ({
        index,
        label: `ownership ${index}`,
        to: "0x0000000000000000000000000000000000000003",
        calldata: "0x1234",
        expectedNoncePolicy: "fresh-per-boundary" as const,
        preconditions: [],
        resumableState: "reviewed",
        postActionVerifier: [],
      })),
      canonicalArtifactMutation: false,
    };
    const checkpoint: OwnershipCheckpoint = {
      schemaVersion: 1,
      releaseId: plan.releaseId,
      manifestHash: plan.manifestHash,
      network: plan.network,
      completed: [
        {
          step: 2,
          label: "ownership 2",
          expectedNonce: 11,
          transactionHash: transactionHash("2"),
          blockNumber: 2,
          verifiedAt,
        },
      ],
    };

    expect(() => validateOwnershipCheckpointPrefix(checkpoint, plan, 3)).toThrow(
      "not the next boundary in the verified prefix",
    );
  });
});
