import { execFileSync, spawnSync } from "node:child_process";
import * as path from "node:path";
import { getAddress, keccak256, toUtf8Bytes } from "ethers";
import { describe, expect, it } from "vitest";
import {
  buildBackfillTransactions,
  type GardenEnumeration,
} from "../../../../.plans/active/commitment-pooling/backfill-pools";

const scriptPath = path.resolve(__dirname, "../../../../.plans/active/commitment-pooling/backfill-pools.ts");
function address(index: number): string {
  return getAddress(`0x${index.toString(16).padStart(40, "0")}`);
}

function gardens(): GardenEnumeration[] {
  return Array.from({ length: 13 }, (_, tokenId) => ({
    tokenId,
    garden: address(tokenId + 100),
    tokenOwner: address(tokenId + 200),
    codeHash: keccak256(toUtf8Bytes(`garden-${tokenId}`)),
  }));
}

describe("one-shot pool backfill entrypoint", () => {
  it("refuses to emit the legacy unpause-first plan that contradicts the authorized release order", () => {
    const enumeration = gardens();
    expect(() =>
      buildBackfillTransactions({
        module: address(1),
        rootGarden: enumeration[1].garden,
        gardens: enumeration,
        startingSafeNonce: 41,
      }),
    ).toThrow(/backfill before the separately gated pooling unpause/);
  });

  it("rejects a stale or duplicate garden enumeration", () => {
    const enumeration = gardens();
    expect(() =>
      buildBackfillTransactions({
        module: address(1),
        rootGarden: enumeration[1].garden,
        gardens: enumeration.slice(0, 12),
        startingSafeNonce: 0,
      }),
    ).toThrow("Expected exactly 13 gardens");

    const duplicate = gardens();
    duplicate[12] = { ...duplicate[12], garden: duplicate[11].garden };
    expect(() =>
      buildBackfillTransactions({
        module: address(1),
        rootGarden: duplicate[1].garden,
        gardens: duplicate,
        startingSafeNonce: 0,
      }),
    ).toThrow("duplicate");
  });

  it("documents only Bun operator entrypoints", () => {
    const output = execFileSync("bun", [scriptPath, "--help"], { encoding: "utf8" });
    expect(output).toContain("bun ../../.plans/active/commitment-pooling/backfill-pools.ts");
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
