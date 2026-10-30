import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { OPERATOR } from "../cli/operations.mjs";
import { writeReleaseJsonAtomic } from "./release-artifacts";
import type { StewardNetwork, StewardPlan } from "./steward-safe-release";
import type { simulateStewardNetwork } from "./steward-safe-simulation";
import { voucherDigest } from "./voucher-release";

export interface StewardRehearsal {
  sourceCommit: string;
  releaseId: string;
  planHash: string;
  rows: Awaited<ReturnType<typeof simulateStewardNetwork>>[];
  liveBroadcast: false;
  activationIncluded: false;
}
export interface StewardExecution {
  schemaVersion: 1;
  planHash: string;
  rehearsalHash: string;
  network: StewardNetwork;
  gasLimit: string;
  maxFeeWei: string;
  maxPriorityFeeWei: string;
  maximumCostWei: string;
  expiresAt: string;
}
export function positiveStewardUint(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value) || BigInt(value) >= 1n << 256n)
    throw new Error("Expected a positive uint256 decimal string");
  return BigInt(value);
}
export function validateStewardRehearsal(plan: StewardPlan, rehearsal: StewardRehearsal) {
  if (
    rehearsal.planHash !== voucherDigest(plan) ||
    rehearsal.sourceCommit !== plan.sourceCommit ||
    rehearsal.releaseId !== plan.releaseId ||
    rehearsal.liveBroadcast !== false ||
    rehearsal.activationIncluded !== false ||
    rehearsal.rows?.length !== 2 ||
    plan.activationIncluded
  )
    throw new Error("Steward rehearsal does not bind the reviewed inactive plan");
  for (const tx of plan.transactions) {
    const rows = rehearsal.rows.filter((row) => row.network === tx.network);
    const row = rows[0];
    if (
      rows.length !== 1 ||
      row.chainId !== tx.chainId ||
      row.address !== tx.address ||
      !/^0x[0-9a-fA-F]{64}$/.test(row.runtimeHash) ||
      !/^0x[0-9a-fA-F]{64}$/.test(row.forkBlockHash) ||
      !Number.isSafeInteger(row.forkBlock) ||
      row.forkBlock < 1 ||
      row.activationIncluded !== false ||
      row.observerRegistered !== false ||
      row.transportDelivered !== false ||
      !row.safe ||
      row.safe.validSigners !== 0 ||
      row.safe.spendingEnabled !== false
    )
      throw new Error("Steward rehearsal requires both locked, empty Safes");
    positiveStewardUint(row.gasUsed);
  }
}
export function validateStewardExecution(
  plan: StewardPlan,
  rehearsal: StewardRehearsal,
  execution: StewardExecution,
  checkExpiry = true,
) {
  validateStewardRehearsal(plan, rehearsal);
  if (
    execution.schemaVersion !== 1 ||
    execution.planHash !== voucherDigest(plan) ||
    execution.rehearsalHash !== voucherDigest(rehearsal) ||
    !["arbitrum", "gnosis"].includes(execution.network)
  )
    throw new Error("Steward execution binding mismatch");
  const gas = positiveStewardUint(execution.gasLimit),
    fee = positiveStewardUint(execution.maxFeeWei);
  if (
    typeof execution.maxPriorityFeeWei !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(execution.maxPriorityFeeWei) ||
    BigInt(execution.maxPriorityFeeWei) > fee
  )
    throw new Error("Invalid steward priority fee cap");
  if (
    positiveStewardUint(execution.maximumCostWei) !== gas * fee ||
    gas < positiveStewardUint(rehearsal.rows.find((row) => row.network === execution.network)!.gasUsed)
  )
    throw new Error("Steward execution budget mismatch");
  const expires = Date.parse(execution.expiresAt);
  if (!Number.isFinite(expires) || (checkExpiry && (expires <= Date.now() || expires > Date.now() + 86_400_000)))
    throw new Error("Steward execution expired or exceeds the one-day validity window");
}
export function stewardCreateArgs(plan: StewardPlan, execution: StewardExecution, rpc: string) {
  const tx = plan.transactions.find((row) => row.network === execution.network)!;
  if (tx.from.toLowerCase() !== OPERATOR.toLowerCase() || tx.to !== null || tx.value !== "0")
    throw new Error("Steward broadcast requires the fixed operator and zero-value CREATE");
  return [
    "send",
    "--create",
    tx.data,
    "--from",
    tx.from,
    "--value",
    "0",
    "--nonce",
    String(tx.nonce),
    "--chain",
    String(tx.chainId),
    "--gas-limit",
    execution.gasLimit,
    "--gas-price",
    `${execution.maxFeeWei}wei`,
    "--priority-gas-price",
    `${execution.maxPriorityFeeWei}wei`,
    "--account",
    "green-goods-deployer",
    "--rpc-url",
    rpc,
    "--async",
    "--json",
  ];
}
export function validateStewardReceipt(
  plan: StewardPlan,
  execution: StewardExecution,
  tx: TransactionResponse,
  receipt: TransactionReceipt,
  canonicalBlockHash: string | null,
) {
  const expected = plan.transactions.find((row) => row.network === execution.network)!;
  if (
    receipt.status !== 1 ||
    receipt.hash !== tx.hash ||
    receipt.blockHash !== canonicalBlockHash ||
    tx.chainId !== BigInt(expected.chainId) ||
    tx.from.toLowerCase() !== expected.from.toLowerCase() ||
    tx.nonce !== expected.nonce ||
    tx.to !== null ||
    tx.value !== 0n ||
    tx.data !== expected.data ||
    receipt.contractAddress?.toLowerCase() !== expected.address.toLowerCase() ||
    tx.gasLimit > BigInt(execution.gasLimit) ||
    (tx.maxFeePerGas ?? tx.gasPrice) > BigInt(execution.maxFeeWei) ||
    (tx.maxPriorityFeePerGas ?? 0n) > BigInt(execution.maxPriorityFeeWei) ||
    receipt.gasUsed * receipt.gasPrice > BigInt(execution.maximumCostWei)
  )
    throw new Error("Steward receipt does not match the canonical bounded CREATE");
}

/** Never clear a submitted intent. An ambiguous send is resolved only by adopting its exact receipt. */
export function stewardExecutionStore(directory: string, plan: StewardPlan, execution: StewardExecution) {
  const tx = plan.transactions.find((row) => row.network === execution.network)!;
  const file = path.join(directory, `create-${tx.chainId}-${tx.address.toLowerCase()}.journal.json`);
  const binding = { planHash: voucherDigest(plan), executionHash: voucherDigest(execution) };
  type Journal = typeof binding & { state: "submitting" | "submitted" | "verified"; hash?: string; evidence?: unknown };
  function read(): Journal | null {
    if (!existsSync(file)) return null;
    if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) throw new Error("Invalid steward journal file");
    const row = JSON.parse(readFileSync(file, "utf8")) as Journal;
    if (row.planHash !== binding.planHash || row.executionHash !== binding.executionHash)
      throw new Error("Existing steward journal binds different reviewed inputs");
    return row;
  }
  return {
    read,
    claim() {
      mkdirSync(directory, { recursive: true });
      const fd = openSync(file, "wx", 0o600);
      try {
        writeFileSync(fd, JSON.stringify({ ...binding, state: "submitting" }));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      const parent = openSync(directory, "r");
      try {
        fsyncSync(parent);
      } finally {
        closeSync(parent);
      }
    },
    record(hash: string, evidence?: unknown) {
      const previous = read();
      if (!previous) throw new Error("Steward receipt requires a durable intent");
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash) || (previous.hash && previous.hash !== hash))
        throw new Error("Steward journal transaction hash mismatch");
      if (previous.state === "verified" && !evidence) throw new Error("Cannot downgrade verified steward receipt");
      writeReleaseJsonAtomic(file, { ...binding, state: evidence ? "verified" : "submitted", hash, evidence });
    },
  };
}
