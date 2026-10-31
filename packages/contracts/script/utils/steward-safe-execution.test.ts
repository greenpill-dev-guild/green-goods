import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AbiCoder, type JsonRpcProvider, type TransactionReceipt, type TransactionResponse } from "ethers";
import { afterEach, describe, expect, it } from "vitest";
import { OPERATOR } from "../cli/operations.mjs";
import {
  positiveStewardUint,
  stewardCreateArgs,
  stewardExecutionStore,
  validateStewardExecution,
  validateStewardReceipt,
  validateStewardRehearsal,
  type StewardExecution,
  type StewardRehearsal,
} from "./steward-safe-execution";
import type { StewardPlan } from "./steward-safe-release";
import { voucherDigest } from "./voucher-release";
import { withStewardActivationRoster } from "./steward-safe-activation";
import family from "../../config/aiyeloja-steward-safe-release.json";
import { inspectStewardManifest } from "./steward-safe-release";
import { checkStewardPeer } from "./steward-safe-readback";
import type { StewardArtifacts } from "./steward-safe-release";

const hash = `0x${"ab".repeat(32)}`;
const address = (n: number) => `0x${String(n).padStart(40, "0")}`;
const plan: StewardPlan = {
  schemaVersion: 1,
  kind: "ROSTER_STEWARD_SAFE",
  sourceCommit: "a".repeat(40),
  releaseId: "fixture-garden",
  manifestHash: hash,
  artifactHashes: {},
  activationIncluded: false,
  liveBroadcast: false,
  observerRegistration: { chainId: 42161, to: address(8), value: "0", data: "0x12", authority: "owner" },
  transactions: (["arbitrum", "gnosis"] as const).map((network, i) => ({
    network,
    chainId: i ? 100 : 42161,
    from: OPERATOR,
    nonce: 10,
    address: address(i + 2),
    to: null,
    value: "0",
    contract: "fixture",
    data: "0x1234",
  })),
};
function fixture() {
  const rehearsal: StewardRehearsal = {
    sourceCommit: plan.sourceCommit,
    releaseId: plan.releaseId,
    planHash: voucherDigest(plan),
    liveBroadcast: false,
    activationIncluded: false,
    rows: plan.transactions.map((tx) => ({
      network: tx.network,
      chainId: tx.chainId,
      address: tx.address,
      gasUsed: "100",
      forkBlock: 123,
      forkBlockHash: hash,
      transactionHash: hash,
      runtimeHash: hash,
      safe: { address: address(4), validSigners: 0, spendingEnabled: false },
      activationIncluded: false,
      observerRegistered: false,
      transportDelivered: false,
      funding: "synthetic",
    })),
  };
  const execution: StewardExecution = {
    schemaVersion: 1,
    planHash: voucherDigest(plan),
    rehearsalHash: voucherDigest(rehearsal),
    network: "arbitrum",
    gasLimit: "130",
    maxFeeWei: "2",
    maxPriorityFeeWei: "1",
    maximumCostWei: "260",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
  return { rehearsal, execution };
}
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
describe("bounded dual-Safe release execution", () => {
  it("rejects a consumed peer nonce or Hats root before deploying an immutable pair", async () => {
    const manifest = inspectStewardManifest(family).manifest;
    let pendingNonce = 10;
    let counter = (BigInt(manifest.expectedTopHat!) >> 224n) - 1n;
    const provider = {
      getNetwork: async () => ({ chainId: 100n }),
      getCode: async () => "0x",
      getTransactionCount: async (_address: string, tag: string) => (tag === "pending" ? pendingNonce : 10),
      call: async () => AbiCoder.defaultAbiCoder().encode(["uint256"], [counter]),
      estimateGas: async () => 100n,
    } as unknown as JsonRpcProvider;
    const check = () => checkStewardPeer(plan, manifest, {} as StewardArtifacts, "gnosis", provider, hash);
    await expect(check()).resolves.toBeUndefined();
    pendingNonce = 11;
    await expect(check()).rejects.toThrow("peer pending nonce");
    pendingNonce = 10;
    counter++;
    await expect(check()).rejects.toThrow("peer next Hats root");
  });
  it("keeps the private readiness roster separate from deployment inputs and rejects unrelated authority", () => {
    const manifest = inspectStewardManifest(family).manifest;
    const roster = { garden: manifest.garden, stewardHat: manifest.stewardHat, accounts: [address(8), address(9)] };
    expect(withStewardActivationRoster(manifest, roster).confirmedStewards).toEqual(roster.accounts);
    expect(manifest.confirmedStewards).toEqual([]);
    for (const patch of [
      { garden: address(77) },
      { stewardHat: "99" },
      { accounts: [address(8), address(8)] },
      { accounts: ["invalid"] },
      { unknown: true },
    ])
      expect(() => withStewardActivationRoster(manifest, { ...roster, ...patch })).toThrow();
  });
  it("binds both empty Safe rehearsals, exact plan, fee ceiling and lifetime", () => {
    const { rehearsal, execution } = fixture();
    expect(() => validateStewardExecution(plan, rehearsal, execution)).not.toThrow();
    for (const patch of [
      { gasLimit: "99" },
      { maximumCostWei: "1" },
      { maxPriorityFeeWei: "3" },
      { maxPriorityFeeWei: "-1" },
      { planHash: hash },
      { network: "celo" },
      { expiresAt: "invalid" },
      { expiresAt: new Date(Date.now() - 1).toISOString() },
    ])
      expect(() => validateStewardExecution(plan, rehearsal, { ...execution, ...patch } as StewardExecution)).toThrow();
    // Receipt recovery is valid after expiry; a new broadcast is not.
    expect(() =>
      validateStewardExecution(plan, rehearsal, { ...execution, expiresAt: "2020-01-01T00:00:00Z" }, false),
    ).not.toThrow();
  });
  it("rejects missing, duplicate, altered or already-active fork proof", () => {
    for (const mutate of [
      (r: StewardRehearsal) => {
        r.rows.pop();
      },
      (r: StewardRehearsal) => {
        r.rows[1] = r.rows[0];
      },
      (r: StewardRehearsal) => {
        r.rows[0].safe!.validSigners = 1;
      },
      (r: StewardRehearsal) => {
        r.rows[0].address = address(99);
      },
      (r: StewardRehearsal) => {
        r.planHash = hash;
      },
      (r: StewardRehearsal) => {
        r.rows[0].forkBlockHash = "0x";
      },
    ]) {
      const { rehearsal } = fixture();
      mutate(rehearsal);
      expect(() => validateStewardRehearsal(plan, rehearsal)).toThrow();
    }
  });
  it("rejects invalid or unbounded budget integers", () => {
    for (const value of ["0", "-1", "1e9", "0x10", "01", 2, String(1n << 256n)])
      expect(() => positiveStewardUint(value)).toThrow();
  });
  it("sends only the exact zero-value CREATE using the fixed keystore with explicit caps", () => {
    const { execution } = fixture(),
      args = stewardCreateArgs(plan, execution, "http://localhost:8545");
    expect(args).toContain("--async");
    expect(args.slice(args.indexOf("--from"), args.indexOf("--from") + 2)).toEqual(["--from", OPERATOR]);
    expect(args).toContain("2wei");
    const changed = structuredClone(plan);
    changed.transactions[0].from = address(99);
    expect(() => stewardCreateArgs(changed, execution, "rpc")).toThrow("fixed operator");
  });
  it("passes the pinned Cast CREATE parser without unlocking a signer", () => {
    const { execution } = fixture();
    const args = stewardCreateArgs(plan, execution, "http://127.0.0.1:1");
    // --help runs the real parser, then exits before wallet access or RPC.
    // Parent flags placed after the --create subcommand fail with exit 2.
    expect(() => execFileSync("cast", [...args, "--help"], { stdio: "ignore" })).not.toThrow();
  });
  it("accepts only the successful canonical exact CREATE within the reviewed budget", () => {
    const { execution } = fixture();
    const tx = {
      ...plan.transactions[0],
      chainId: 42161n,
      hash,
      value: 0n,
      gasLimit: 130n,
      maxFeePerGas: 2n,
    } as unknown as TransactionResponse;
    const receipt = {
      status: 1,
      hash,
      blockHash: hash,
      contractAddress: plan.transactions[0].address,
      gasUsed: 100n,
      gasPrice: 2n,
    } as TransactionReceipt;
    expect(() => validateStewardReceipt(plan, execution, tx, receipt, hash)).not.toThrow();
    for (const patch of [
      { from: address(9) },
      { nonce: 11 },
      { data: "0xabcd" },
      { value: 1n },
      { to: address(9) },
      { chainId: 100n },
      { gasLimit: 131n },
      { maxFeePerGas: 3n },
      { maxPriorityFeePerGas: 2n },
    ])
      expect(() =>
        validateStewardReceipt(plan, execution, { ...tx, ...patch } as TransactionResponse, receipt, hash),
      ).toThrow();
    for (const patch of [
      { status: 0 },
      { contractAddress: address(9) },
      { gasPrice: 3n },
      { hash: `0x${"cd".repeat(32)}` },
    ])
      expect(() =>
        validateStewardReceipt(plan, execution, tx, { ...receipt, ...patch } as TransactionReceipt, hash),
      ).toThrow();
    expect(() => validateStewardReceipt(plan, execution, tx, receipt, null)).toThrow();
  });
  it("retains ambiguous intent across processes and allows only the same receipt to be adopted", () => {
    const { execution } = fixture(),
      directory = mkdtempSync(path.join(os.tmpdir(), "steward-release-test-"));
    dirs.push(directory);
    const store = stewardExecutionStore(directory, plan, execution);
    store.claim();
    const resumed = stewardExecutionStore(directory, plan, execution);
    expect(resumed.read()?.state).toBe("submitting");
    expect(() => resumed.claim()).toThrow();
    resumed.record(hash);
    expect(() => resumed.record(`0x${"cd".repeat(32)}`)).toThrow("hash mismatch");
    resumed.record(hash, { verified: true });
    expect(resumed.read()?.state).toBe("verified");
    expect(() => resumed.record(hash)).toThrow("downgrade");
    expect(() => stewardExecutionStore(directory, plan, { ...execution, gasLimit: "150" }).read()).toThrow(
      "different reviewed inputs",
    );
  });
});
