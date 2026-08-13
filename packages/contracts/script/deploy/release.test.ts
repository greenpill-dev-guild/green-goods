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
import { formatCastFailure, parseCastTransactionHash } from "../utils/cast-env";
import { buildReleaseLock, loadReleaseManifest } from "../utils/release-manifest";
import type { ReleaseTransactionBoundary } from "../utils/release-plan";
import { buildStageTransactionPlan } from "../utils/release-plan";

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
  it("redacts RPC credentials from captured Cast failures", () => {
    const error = { stderr: "transport failed for https://arb-mainnet.g.alchemy.com/v2/private-key" };

    expect(formatCastFailure(error, "Cast send").message).toContain("https://[REDACTED]");
    expect(formatCastFailure(error, "Cast send").message).not.toContain("private-key");
  });

  it("runs every release verifier without the deployment password environment", () => {
    const source = fs.readFileSync(path.join(CONTRACTS_ROOT, "script/deploy/release.ts"), "utf8");
    const verifierCalls = source.match(/script\/release-verify\.ts[\s\S]{0,700}?env: ([^ }]+)[ }]/gu) ?? [];

    expect(verifierCalls).toHaveLength(3);
    expect(verifierCalls.every((call) => call.includes("buildReadOnlyCastEnv()"))).toBe(true);
    expect(source).toContain(
      'execFileSync("bun", args, { cwd: CONTRACTS_ROOT, stdio: "inherit", env: buildReadOnlyCastEnv() })',
    );
  });

  it("reverifies and promotes a checkpointed final release boundary before returning", () => {
    const source = fs.readFileSync(path.join(CONTRACTS_ROOT, "script/deploy/release.ts"), "utf8");
    const replayStart = source.indexOf("if (checkpoint && checkpoint.lastVerifiedStep >= boundary.index)");
    const freshNonceCheck = source.indexOf("if (!options.receiptHash) await this.assertLiveNonce", replayStart);
    const replayBranch = source.slice(replayStart, freshNonceCheck);

    expect(replayStart).toBeGreaterThan(0);
    expect(replayBranch).toContain("verifyReleaseReceipt");
    expect(replayBranch).toContain("this.runBoundaryVerifier");
    expect(replayBranch).toContain("this.runStageVerifier");
    expect(replayBranch).toContain("mergeReleaseArtifact");
    expect(replayBranch).toContain("no replay transaction was sent");
  });

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
    const manifest = loadReleaseManifest();
    const frozenSalt = `${manifest.create2.domain}:${manifest.create2.version}`;
    const args = [
      "settlement-module",
      "--network",
      "arbitrum",
      "--pure-simulation",
      "--salt",
      frozenSalt,
      "--expected-nonce",
      "700",
    ];
    const first = run(args);
    const replay = run(args);
    expect(first).toContain(`"baseSalt": "${frozenSalt}"`);
    expect(replay).toContain(`"baseSalt": "${frozenSalt}"`);
    expect(fs.readFileSync(ARBITRUM_ARTIFACT).equals(arbitrumBefore)).toBe(true);
    expect(fs.readFileSync(CELO_ARTIFACT).equals(celoBefore)).toBe(true);
  });

  it("routes the pooling command through the selective release stage", () => {
    const output = run(["pooling", "--network", "arbitrum", "--pure-simulation", "--expected-nonce", "700"]);
    expect(output).toContain('"stage": "pooling"');
    expect(output).toContain("implementation:CommitmentPoolingModule");
    expect(output).toContain("set Assessment v3 schema UID");
  });

  it("rejects release-stage plans that are not bound to a reviewed nonce", () => {
    const result = fail(["pooling", "--network", "arbitrum", "--pure-simulation"]);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("planning and dry-run require --expected-nonce");
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
    expect(corePlan).toContain(
      '"command": "bun run pooling:deploy:dry:arbitrum --expected-nonce <fresh-pending-nonce>"',
    );
    expect(corePlan).toContain(
      '"command": "bun run settlement:module:plan:arbitrum --expected-nonce <fresh-pending-nonce>"',
    );
    expect(corePlan).toContain(
      '"command": "bun run credit:registry:plan:arbitrum --expected-nonce <fresh-pending-nonce>"',
    );

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

  it("documents a reviewed nonce on every release-stage planning command", () => {
    const cliHelp = fs.readFileSync(path.join(CONTRACTS_ROOT, "script/deploy/cli.ts"), "utf8");
    const handoff = fs.readFileSync(
      path.join(CONTRACTS_ROOT, "../../.plans/active/commitment-pooling/handoffs/human-release-ops.md"),
      "utf8",
    );
    const requiredCommands = [
      "pooling:deploy:dry:arbitrum --expected-nonce <fresh-pending-nonce>",
      "settlement:module:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
      "credit:registry:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
      "settlement:executor:plan:celo --expected-nonce <fresh-pending-nonce>",
    ];

    for (const command of requiredCommands) expect(cliHelp).toContain(command);
    expect(handoff).toContain("contracts:pooling:deploy:dry:arbitrum --expected-nonce <fresh-pending-nonce>");
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

  it("binds every release-stage boundary to the reviewed starting nonce", () => {
    const manifest = loadReleaseManifest();
    const lock = buildReleaseLock(manifest);
    const deployment = JSON.parse(fs.readFileSync(ARBITRUM_ARTIFACT, "utf8")) as Record<string, unknown>;
    const plan = buildStageTransactionPlan(
      manifest,
      lock,
      "pooling",
      deployment,
      `${manifest.create2.domain}:${manifest.create2.version}`,
      700,
    );

    expect(plan.expectedNonce).toBe(700);
    expect(plan.transactions.map((boundary) => boundary.nonce)).toEqual(
      plan.transactions.map((_, index) => 700 + index),
    );
  });

  it("rejects a release checkpoint that omits any earlier receipt boundary", () => {
    const transactions = [1, 2, 3].map(
      (index): ReleaseTransactionBoundary => ({
        index,
        nonce: 10 + index,
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

  it("rejects receipt evidence whose nonce differs from the reviewed boundary", () => {
    const transactions: ReleaseTransactionBoundary[] = [
      {
        index: 1,
        nonce: 21,
        stage: "pooling",
        kind: "configuration",
        label: "boundary 1",
        network: "arbitrum",
        sender: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        preconditions: [],
        resumableState: "reviewed",
        postActionVerifier: [],
      },
    ];
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
          index: 1,
          label: "boundary 1",
          expectedNonce: 22,
          transactionHash: transactionHash("1"),
          blockNumber: 1,
          verifiedAt,
        },
      ],
    };

    expect(() => validateReleaseCheckpointPrefix(checkpoint, transactions, 1)).toThrow(
      "not one contiguous reviewed prefix",
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
