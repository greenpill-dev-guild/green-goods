import { execFileSync, spawnSync } from "node:child_process";
import * as path from "node:path";
import { getAddress, Interface, keccak256, toUtf8Bytes, type TransactionResponse } from "ethers";
import { describe, expect, it } from "vitest";
import {
  buildBackfillTransactions,
  parseSafeExecution,
  validateBackfillPlan,
  validateCheckpointPrefix,
  type BackfillCheckpoint,
  type GardenEnumeration,
  type PoolBackfillPlan,
} from "./backfill-pools";

const scriptPath = path.resolve(__dirname, "backfill-pools.ts");
const moduleInterface = new Interface([
  "function setPaused(bool paused)",
  "function registerPool(address garden,uint8 poolType) returns (uint256 poolId)",
]);
function address(index: number): string {
  return getAddress(`0x${index.toString(16).padStart(40, "0")}`);
}

function gardens(): GardenEnumeration[] {
  return Array.from({ length: 18 }, (_, tokenId) => ({
    tokenId,
    garden: address(tokenId + 100),
    tokenOwner: address(tokenId + 200),
    codeHash: keccak256(toUtf8Bytes(`garden-${tokenId}`)),
  }));
}

function plan(): PoolBackfillPlan {
  const enumeration = gardens();
  const module = address(1);
  const owner = address(2);
  const rootGarden = enumeration[0].garden;
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-11T00:00:00.000Z",
    releaseId: "commitment-pooling-settlement-credit-v1",
    releaseManifestHash: keccak256(toUtf8Bytes("manifest")),
    releaseSourceCommit: "1".repeat(40),
    network: "arbitrum",
    chainId: 42161,
    finalizedBlock: 123,
    module,
    moduleDeploymentPending: false,
    owner,
    expectedSafeNonce: 41,
    gardenToken: address(3),
    gardenAccountImplementation: address(4),
    tokenboundRegistry: "0x000000006551c19487814612e58FE06813775758",
    tokenboundSalt: "0x6551655165516551655165516551655165516551655165516551655165516551",
    rootGarden,
    rootTokenId: 0,
    expectedGardenCount: 18,
    gardens: Object.fromEntries(
      enumeration.map((garden) => [
        garden.garden.toLowerCase(),
        {
          ...garden,
          status: garden.garden === rootGarden ? ("SKIPPED_PROTOCOL_ROOT" as const) : ("PLANNED" as const),
        },
      ]),
    ),
    transactions: buildBackfillTransactions({ module, rootGarden, gardens: enumeration, startingSafeNonce: 41 }),
    transactionBoundaryRule:
      "Authorize and execute one direct Safe execTransaction payload, verify its receipt and post-state, then stop.",
    canonicalArtifactMutation: false,
  };
}

function checkpoint(reviewedPlan: PoolBackfillPlan, throughStep: number): BackfillCheckpoint {
  const completed = reviewedPlan.transactions.slice(0, throughStep).map((transaction) => ({
    step: transaction.index,
    safeNonce: transaction.safeNonce,
    transactionHash: keccak256(toUtf8Bytes(`receipt-${transaction.index}`)),
    blockNumber: 200 + transaction.index,
    verifiedAt: "2026-08-11T00:00:00.000Z",
  }));
  const result: BackfillCheckpoint = {
    schemaVersion: 1,
    releaseId: reviewedPlan.releaseId,
    releaseManifestHash: reviewedPlan.releaseManifestHash,
    chainId: 42161,
    module: reviewedPlan.module,
    owner: reviewedPlan.owner,
    planHash: keccak256(toUtf8Bytes("plan")),
    activation: { status: "PLANNED" },
    protocolRegistration: {
      rootGarden: reviewedPlan.rootGarden,
      status: throughStep >= 1 ? "VERIFIED" : "PLANNED",
      ...(throughStep >= 1 ? { poolId: "1" } : {}),
    },
    gardens: Object.fromEntries(
      Object.entries(reviewedPlan.gardens).map(([garden, record]) => [
        garden,
        {
          ...record,
          status:
            garden === reviewedPlan.rootGarden.toLowerCase()
              ? "SKIPPED_PROTOCOL_ROOT"
              : reviewedPlan.transactions.find(
                    (transaction) => transaction.garden?.toLowerCase() === garden && transaction.index <= throughStep,
                  )
                ? "REGISTERED"
                : "PLANNED",
          ...(garden !== reviewedPlan.rootGarden.toLowerCase() &&
          reviewedPlan.transactions.find(
            (transaction) => transaction.garden?.toLowerCase() === garden && transaction.index <= throughStep,
          )
            ? {
                poolId: String(
                  reviewedPlan.transactions.find((transaction) => transaction.garden?.toLowerCase() === garden)?.index,
                ),
                transactionHash: completed.find(
                  (entry) =>
                    entry.step ===
                    reviewedPlan.transactions.find((transaction) => transaction.garden?.toLowerCase() === garden)
                      ?.index,
                )?.transactionHash,
                blockNumber: completed.find(
                  (entry) =>
                    entry.step ===
                    reviewedPlan.transactions.find((transaction) => transaction.garden?.toLowerCase() === garden)
                      ?.index,
                )?.blockNumber,
              }
            : {}),
        },
      ]),
    ),
    completed,
  };
  if (throughStep >= 1) {
    result.protocolRegistration.transactionHash = completed[0].transactionHash;
    result.protocolRegistration.blockNumber = completed[0].blockNumber;
  }
  return result;
}

describe("one-shot pool backfill entrypoint", () => {
  it("registers every pool while paused and emits unpause as the final separate boundary", () => {
    const enumeration = gardens();
    const transactions = buildBackfillTransactions({
      module: address(1),
      rootGarden: enumeration[0].garden,
      gardens: enumeration,
      startingSafeNonce: 41,
    });

    expect(transactions).toHaveLength(19);
    expect(transactions[0]).toMatchObject({
      index: 1,
      kind: "REGISTER_PROTOCOL",
      garden: enumeration[0].garden,
      tokenId: 0,
      safeNonce: 41,
    });
    expect(moduleInterface.decodeFunctionData("registerPool", transactions[0].data)).toEqual([
      enumeration[0].garden,
      1n,
    ]);
    for (const transaction of transactions.slice(0, -1)) expect(transaction.kind).not.toBe("UNPAUSE");
    expect(transactions.at(-1)).toMatchObject({ index: 19, kind: "UNPAUSE", safeNonce: 59 });
    expect(moduleInterface.decodeFunctionData("setPaused", transactions.at(-1)!.data)).toEqual([false]);
  });

  it("rejects a stale or duplicate garden enumeration", () => {
    const enumeration = gardens();
    expect(() =>
      buildBackfillTransactions({
        module: address(1),
        rootGarden: enumeration[0].garden,
        gardens: enumeration.slice(0, 17),
        startingSafeNonce: 0,
      }),
    ).toThrow("Expected exactly 18 gardens");

    const duplicate = gardens();
    duplicate[17] = { ...duplicate[17], garden: duplicate[16].garden };
    expect(() =>
      buildBackfillTransactions({
        module: address(1),
        rootGarden: duplicate[0].garden,
        gardens: duplicate,
        startingSafeNonce: 0,
      }),
    ).toThrow("duplicate");
  });

  it("rejects every mutation of the canonical root-first transaction plan", () => {
    const canonical = plan();
    expect(() => validateBackfillPlan(canonical)).not.toThrow();

    const mutations: Array<(candidate: PoolBackfillPlan) => void> = [
      (candidate) => {
        candidate.transactions[0] = candidate.transactions.at(-1)!;
      },
      (candidate) => {
        candidate.transactions[1].data = moduleInterface.encodeFunctionData("setPaused", [false]);
      },
      (candidate) => {
        candidate.transactions[1].safeNonce += 1;
      },
      (candidate) => {
        candidate.transactions[1].to = address(999);
      },
      (candidate) => {
        candidate.transactions[1].value = "1" as "0";
      },
      (candidate) => {
        candidate.transactions[1].operation = 1 as 0;
      },
      (candidate) => {
        candidate.transactions.pop();
      },
      (candidate) => {
        delete candidate.gardens[candidate.transactions[1].garden!.toLowerCase()];
      },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(canonical);
      mutate(candidate);
      expect(() => validateBackfillPlan(candidate)).toThrow();
    }
  });

  it("requires one contiguous verified prefix and every registration before unpause", () => {
    const canonical = plan();
    const firstOnly = checkpoint(canonical, 1);
    expect(() => validateCheckpointPrefix(firstOnly, canonical, 2)).not.toThrow();

    const gap = checkpoint(canonical, 2);
    gap.completed[1].step = 3;
    expect(() => validateCheckpointPrefix(gap, canonical, 3)).toThrow("contiguous");

    const duplicate = checkpoint(canonical, 2);
    duplicate.completed[1].step = 1;
    expect(() => validateCheckpointPrefix(duplicate, canonical, 3)).toThrow("duplicate");

    expect(() => validateCheckpointPrefix(checkpoint(canonical, 17), canonical, 19)).toThrow(
      "Final unpause requires every registration",
    );
    expect(() => validateCheckpointPrefix(checkpoint(canonical, 18), canonical, 19)).not.toThrow();

    const missingGarden = checkpoint(canonical, 18);
    delete missingGarden.gardens[canonical.transactions[1].garden!.toLowerCase()];
    expect(() => validateCheckpointPrefix(missingGarden, canonical, 19)).toThrow("Garden set");

    const changedGarden = checkpoint(canonical, 18);
    changedGarden.gardens[canonical.transactions[1].garden!.toLowerCase()].codeHash = keccak256(
      toUtf8Bytes("tampered"),
    );
    expect(() => validateCheckpointPrefix(changedGarden, canonical, 19)).toThrow("differs from the reviewed plan");
  });

  it("rejects a recovery receipt that attaches native value to the Safe", () => {
    const reviewedPlan = plan();
    const transaction = {
      to: reviewedPlan.owner,
      value: 1n,
      data: "0x",
    } as TransactionResponse;

    expect(() => parseSafeExecution(transaction, reviewedPlan.transactions[0], reviewedPlan.owner)).toThrow(
      "may not attach native value",
    );
  });

  it("documents only Bun operator entrypoints", () => {
    const output = execFileSync("bun", [scriptPath, "--help"], { encoding: "utf8" });
    expect(output).toContain("bun script/deploy/backfill-pools.ts");
    expect(output).not.toMatch(/(?:^|\n)\s*forge\s/mu);
    expect(output).not.toMatch(/(?:^|\n)\s*cast\s/mu);
  });

  it("fails closed before RPC when a release boundary lacks its reviewed evidence", () => {
    const result = spawnSync("bun", [scriptPath, "--network", "arbitrum", "--broadcast", "--override-sepolia-gate"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "requires --plan, --step, --expected-safe-nonce, and --receipt",
    );
  });
});
