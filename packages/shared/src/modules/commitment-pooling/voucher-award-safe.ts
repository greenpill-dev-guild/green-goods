import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  hashTypedData,
  parseAbi,
  recoverTypedDataAddress,
  type Hex,
  zeroAddress,
} from "viem";
import type { Address } from "../../types/domain";
import type {
  VoucherAwardInput,
  VoucherAwardRecord,
  VoucherAwardSafe,
} from "../../public-contracts/voucher-awards";
import type { ContractCall } from "../transactions/types";

export const VOUCHER_AWARD_SAFE_ABI = parseAbi([
  "function nonce() view returns(uint256)",
  "function getThreshold() view returns(uint256)",
  "function isOwner(address owner) view returns(bool)",
  "function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 _nonce) view returns(bytes32)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns(bool)",
  "event ExecutionSuccess(bytes32 txHash,uint256 payment)",
  "event ExecutionFailure(bytes32 txHash,uint256 payment)",
]);
const INDEXED_SAFE_EVENTS = parseAbi([
  "event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)",
  "event ExecutionFailure(bytes32 indexed txHash,uint256 payment)",
]);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export function voucherAwardSafeTypedData(award: VoucherAwardInput, nonce: bigint) {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [award.recipient, BigInt(award.amount)],
  });
  const message = {
    to: award.token,
    value: 0n,
    data,
    operation: 0,
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: zeroAddress,
    refundReceiver: zeroAddress,
    nonce,
  };
  return {
    domain: { chainId: 100, verifyingContract: award.reserve },
    primaryType: "SafeTx" as const,
    types: {
      SafeTx: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "operation", type: "uint8" },
        { name: "safeTxGas", type: "uint256" },
        { name: "baseGas", type: "uint256" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "refundReceiver", type: "address" },
        { name: "nonce", type: "uint256" },
      ],
    },
    message,
  };
}
export function voucherAwardSafeEnvelope(
  award: VoucherAwardInput,
  nonce: bigint,
  threshold: number
): VoucherAwardSafe {
  const typed = voucherAwardSafeTypedData(award, nonce);
  const { data } = typed.message;
  const safeTxHash = hashTypedData(typed);
  return {
    safe: award.reserve,
    chainId: 100,
    to: award.token,
    value: "0",
    data,
    operation: 0,
    safeTxGas: "0",
    baseGas: "0",
    gasPrice: "0",
    gasToken: zeroAddress,
    refundReceiver: zeroAddress,
    nonce: nonce.toString(),
    safeTxHash,
    threshold,
  };
}
export function assertVoucherAwardSafe(record: VoucherAwardRecord): void {
  if (
    !record.safe ||
    !/^(0|[1-9]\d{0,77})$/.test(record.safe.nonce) ||
    BigInt(record.safe.nonce) >= 1n << 256n ||
    !Number.isSafeInteger(record.safe.threshold) ||
    record.safe.threshold < 1 ||
    record.safe.threshold > 100
  )
    throw new Error("Invalid Safe envelope");
  const expected = voucherAwardSafeEnvelope(
    record.award,
    BigInt(record.safe.nonce),
    record.safe.threshold
  );
  if (JSON.stringify(expected) !== JSON.stringify(record.safe))
    throw new Error("Award transaction changed");
}
/** The signature binds the nonce onchain; a prevalidated v=1 owner call would be replayable. */
export async function voucherAwardOwnerCall(
  record: VoucherAwardRecord,
  owner: Address,
  signature: Hex
): Promise<ContractCall> {
  assertVoucherAwardSafe(record);
  if (
    record.safe.threshold !== 1 ||
    (record.state !== "awaiting_authorization" &&
      !(record.state === "failed" && record.failure === "transaction_reverted"))
  )
    throw new Error("Award requires Safe review or reconciliation");
  if (
    !/^0x[a-f\d]{128}(1b|1c)$/i.test(signature) ||
    !same(
      await recoverTypedDataAddress({
        ...voucherAwardSafeTypedData(record.award, BigInt(record.safe.nonce)),
        signature,
      }),
      owner
    )
  )
    throw new Error("Exact nonce-bound owner signature required");
  return {
    account: owner,
    chainId: 100,
    address: record.safe.safe,
    abi: VOUCHER_AWARD_SAFE_ABI,
    functionName: "execTransaction",
    args: [
      record.safe.to,
      0n,
      record.safe.data,
      0,
      0n,
      0n,
      0n,
      zeroAddress,
      zeroAddress,
      signature,
    ],
    value: 0n,
  };
}
export function assertVoucherAwardCalldata(record: VoucherAwardRecord, input: Hex): void {
  assertVoucherAwardSafe(record);
  const decoded = decodeFunctionData({ abi: VOUCHER_AWARD_SAFE_ABI, data: input });
  if (decoded.functionName !== "execTransaction") throw new Error("Unrelated Safe transaction");
  const args = decoded.args;
  if (
    !same(args[0], record.safe.to) ||
    args[1] !== 0n ||
    !same(args[2], record.safe.data) ||
    args[3] !== 0 ||
    args[4] !== 0n ||
    args[5] !== 0n ||
    args[6] !== 0n ||
    !same(args[7], zeroAddress) ||
    !same(args[8], zeroAddress) ||
    args[9] === "0x"
  )
    throw new Error("Award transaction does not match the reviewed Safe call");
}
/** Pending/reverted outer calls have no Safe event: require signatures bound to this nonce. */
export async function recoverVoucherAwardSigners(
  record: VoucherAwardRecord,
  input: Hex
): Promise<Address[]> {
  assertVoucherAwardCalldata(record, input);
  const decoded = decodeFunctionData({ abi: VOUCHER_AWARD_SAFE_ABI, data: input });
  if (decoded.functionName !== "execTransaction") throw new Error("Unrelated Safe transaction");
  const signatures = decoded.args[9].slice(2);
  if (signatures.length !== record.safe.threshold * 130)
    throw new Error("Unverified Safe signatures");
  const owners: Address[] = [];
  for (let i = 0; i < signatures.length; i += 130) {
    const signature = `0x${signatures.slice(i, i + 130)}` as Hex;
    if (!/^0x[a-f\d]{128}(1b|1c)$/i.test(signature)) throw new Error("Unverified Safe signatures");
    const owner = await recoverTypedDataAddress({
      ...voucherAwardSafeTypedData(record.award, BigInt(record.safe.nonce)),
      signature,
    });
    if (owners.length && owner.toLowerCase() <= owners[owners.length - 1].toLowerCase())
      throw new Error("Unsorted Safe signatures");
    owners.push(owner);
  }
  return owners;
}
export function verifyVoucherAwardLogs(
  record: VoucherAwardRecord,
  logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[]
): "confirmed" | "safe_execution_failed" {
  let result: "confirmed" | "safe_execution_failed" | null = null;
  let transferred = 0n;
  for (const log of logs) {
    if (same(log.address, record.safe.safe))
      for (const abi of [VOUCHER_AWARD_SAFE_ABI, INDEXED_SAFE_EVENTS]) {
        try {
          const event = decodeEventLog({
            abi,
            topics: log.topics as [Hex, ...Hex[]],
            data: log.data,
          });
          if (
            (event.eventName === "ExecutionSuccess" || event.eventName === "ExecutionFailure") &&
            same(event.args.txHash, record.safe.safeTxHash)
          ) {
            if (result) throw new Error("Duplicate Safe outcome");
            result = event.eventName === "ExecutionSuccess" ? "confirmed" : "safe_execution_failed";
          }
        } catch (error) {
          if (error instanceof Error && error.message === "Duplicate Safe outcome") throw error;
        }
      }
    if (same(log.address, record.award.token)) {
      try {
        const event = decodeEventLog({
          abi: erc20Abi,
          topics: log.topics as [Hex, ...Hex[]],
          data: log.data,
        });
        if (
          event.eventName === "Transfer" &&
          same(event.args.from, record.award.reserve) &&
          same(event.args.to, record.award.recipient)
        )
          transferred += event.args.value;
      } catch {
        /* Other token events do not prove delivery. */
      }
    }
  }
  if (
    !result ||
    (result === "confirmed" && transferred !== BigInt(record.award.amount)) ||
    (result === "safe_execution_failed" && transferred !== 0n)
  )
    throw new Error("Exact Safe and token delivery receipts required");
  return result;
}
