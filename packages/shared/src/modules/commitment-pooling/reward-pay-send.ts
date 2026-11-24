/**
 * Paying a promise's Safe-paid shares
 *
 * The paying garden holds a reward's USDC in its Safe on the promise's chain and
 * pays the shares from that Safe through the reward payer (PRD-1556). A garden's
 * own account never holds it, and no steward pays from their own wallet. The
 * payment is one Safe transaction: through MultiSendCallOnly it approves the
 * payer for exactly the shares' total and pays every share in the same call, so
 * nothing is left approved and the shares land together or not at all.
 *
 * The Safe's owners approve that transaction on chain, each from their own
 * account (`approveHash`), and the owner whose approval completes the threshold
 * runs it (`execTransaction`), their own call standing in for their approval.
 * Nothing is kept off chain: every owner builds the same transaction from what
 * is still owed and the Safe's next nonce, so the approvals so far are read back
 * from the Safe. A share paid, or another Safe transaction run, in the meantime
 * changes the transaction, and its approvals start again.
 *
 * Before anything is asked, a fresh read has to show that the part still owes
 * exactly the shares the steward was shown, that the Safe holds their total and
 * that the steward is one of its owners: the payer refuses a paid share and the
 * token an amount the Safe doesn't hold, so either would only cost a signature.
 *
 * @module modules/commitment-pooling/reward-pay-send
 */

import { readContract } from "@wagmi/core";
import {
  type Abi,
  concat,
  encodeFunctionData,
  encodePacked,
  type Hex,
  pad,
  parseAbi,
  size,
  zeroAddress,
} from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { logger } from "../app/logger";
import type { Address } from "../../types/domain";
import { ERC20_ALLOWANCE_ABI, ERC20_BALANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { isZeroAddress } from "../../utils/blockchain/address";
import type { TransactionSender } from "../transactions/types";
import { mayStillLand } from "../../utils/errors/tx-error-classifier";
import { missOfSend } from "./creation-send";
import {
  REWARD_PAYER_ABI,
  type RewardPayerShare,
  rewardPayerShareId,
  rewardSharesOwed,
} from "./reward-payer";
import type { SeedCopyMiss } from "./seed-sets";

/**
 * Safe's MultiSendCallOnly 1.4.1, the batching target a garden Safe runs the payment through. It
 * makes calls only, never a delegatecall of its own, so the Safe runs nothing but the two calls.
 */
export const REWARD_SAFE_MULTI_SEND = "0x9641d764fc13c8B624c04430C7356C1C7C8102e2" as Address;

export const REWARD_SAFE_ABI = parseAbi([
  "function nonce() view returns (uint256)",
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
  "function approvedHashes(address owner, bytes32 hash) view returns (uint256)",
  "function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
  "function approveHash(bytes32 hashToApprove)",
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool success)",
]);

const MULTI_SEND_ABI = parseAbi(["function multiSend(bytes transactions) payable"]);

/** A Safe operation that runs its target's code as the Safe: here, only MultiSendCallOnly. */
const DELEGATECALL = 1;

/** What a payment reads from the payout chain. */
export interface RewardPayChain {
  balance(token: Address, owner: Address): Promise<bigint>;
  /** Who paid a share; the zero address while it is unpaid. */
  paidBy(payer: Address, shareId: Hex): Promise<Address>;
  /** A Safe's owners, how many of them must approve, and the nonce its next transaction takes. */
  safeState(safe: Address): Promise<{ owners: Address[]; threshold: bigint; nonce: bigint }>;
  /** The hash the Safe records approvals of a transaction under. */
  safeTransactionHash(
    safe: Address,
    transaction: { to: Address; data: Hex; operation: number; nonce: bigint }
  ): Promise<Hex>;
  /** Whether an owner has approved a transaction hash on chain. */
  approvedHash(safe: Address, owner: Address, hash: Hex): Promise<boolean>;
}

/** The payout chain as the app's wallet configuration reads it. */
export function createRewardPayChain(chainId: number): RewardPayChain {
  const read = <T>(request: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: unknown[];
  }) => readContract(getWagmiConfig(), { ...request, chainId }) as Promise<T>;
  const safeRead = <T>(safe: Address, functionName: string, args: unknown[] = []) =>
    read<T>({ address: safe, abi: REWARD_SAFE_ABI as unknown as Abi, functionName, args });
  return {
    balance: (token, owner) =>
      read<bigint>({
        address: token,
        abi: ERC20_BALANCE_ABI as unknown as Abi,
        functionName: "balanceOf",
        args: [owner],
      }),
    paidBy: (payer, shareId) =>
      read<Address>({
        address: payer,
        abi: REWARD_PAYER_ABI as unknown as Abi,
        functionName: "paidBy",
        args: [shareId],
      }),
    safeState: async (safe) => {
      const [owners, threshold, nonce] = await Promise.all([
        safeRead<readonly Address[]>(safe, "getOwners"),
        safeRead<bigint>(safe, "getThreshold"),
        safeRead<bigint>(safe, "nonce"),
      ]);
      return { owners: [...owners], threshold, nonce };
    },
    safeTransactionHash: (safe, transaction) =>
      safeRead<Hex>(safe, "getTransactionHash", [
        transaction.to,
        0n,
        transaction.data,
        transaction.operation,
        0n,
        0n,
        0n,
        zeroAddress,
        zeroAddress,
        transaction.nonce,
      ]),
    approvedHash: async (safe, owner, hash) =>
      (await safeRead<bigint>(safe, "approvedHashes", [owner, hash])) !== 0n,
  };
}

/** Why a payment wasn't asked for, read before any signature. */
type RewardPayRefusal =
  | "no-shares"
  | "mixed-tokens"
  /** A share is owed to the Safe itself, which the payer refuses. */
  | "self-payment"
  /** A share was paid since the list was read: what is owed has changed. */
  | "already-paid"
  | "insufficient-balance"
  /** The account asking is not one of the Safe's owners. */
  | "not-an-owner"
  /**
   * The Safe's approvals moved since the owner read them, so the step they pressed (approve, or
   * run the payment) is no longer the one their signature would take.
   */
  | "approvals-changed"
  /** A read before asking failed, so nothing was asked for. */
  | "unreadable";

/** The one Safe transaction that pays a part's owed shares, as every owner builds it. */
interface RewardSafeTransaction {
  safe: Address;
  to: Address;
  data: Hex;
  operation: typeof DELEGATECALL;
  nonce: bigint;
  /** The hash the Safe records approvals under. */
  hash: Hex;
}

/** Where a garden Safe's payment of the owed shares stands, read afresh. */
export type RewardSafePaymentRead =
  | {
      status: "ready";
      transaction: RewardSafeTransaction;
      owners: Address[];
      threshold: number;
      /** The owners who have approved this exact transaction on chain. */
      approvedBy: Address[];
      total: bigint;
      shareIds: Hex[];
    }
  | { status: "refused"; refusal: RewardPayRefusal };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Approve the payer for exactly `total` and pay every share, as MultiSendCallOnly's packed calls. */
function paymentCalldata(
  payer: Address,
  token: Address,
  total: bigint,
  shares: readonly RewardPayerShare[]
): Hex {
  const approve = encodeFunctionData({
    abi: ERC20_ALLOWANCE_ABI as unknown as Abi,
    functionName: "approve",
    args: [payer, total],
  });
  const payAll = encodeFunctionData({
    abi: REWARD_PAYER_ABI,
    functionName: "payAll",
    args: [
      shares.map((share) => ({
        promiseChainId: BigInt(share.promiseChainId),
        promiseModule: share.promiseModule,
        commitmentId: share.commitmentId,
        token: share.token,
        recipient: share.recipient,
        amount: share.amount,
      })),
    ],
  });
  const packed = ([to, data]: readonly [Address, Hex]) =>
    encodePacked(
      ["uint8", "address", "uint256", "uint256", "bytes"],
      [0, to, 0n, BigInt(size(data)), data]
    );
  return encodeFunctionData({
    abi: MULTI_SEND_ABI,
    functionName: "multiSend",
    args: [concat([packed([token, approve]), packed([payer, payAll])])],
  });
}

/**
 * Where the Safe's payment of the shown shares stands, read before asking and for the Hub's
 * view. The shares must be in the part's one token and owed to someone other than the Safe. Read
 * afresh, the part must still owe exactly them, and the Safe must hold their total.
 */
export async function readRewardSafePayment(input: {
  chain: RewardPayChain;
  payer: Address;
  safe: Address;
  /** Every share of the part being paid, so a fresh read can tell which are still owed. */
  partShares: readonly RewardPayerShare[];
  /** The shares the steward was shown as owed. */
  shown: readonly RewardPayerShare[];
}): Promise<RewardSafePaymentRead> {
  const { chain, payer, safe, partShares, shown } = input;
  const [first] = shown;
  if (!first) return { status: "refused", refusal: "no-shares" };
  const token = first.token;
  if (partShares.some((share) => !same(share.token, token))) {
    return { status: "refused", refusal: "mixed-tokens" };
  }
  // The payer refuses a payment to the payer itself, and payAll would take every share with it.
  if (shown.some((share) => same(share.recipient, safe))) {
    return { status: "refused", refusal: "self-payment" };
  }
  const paidBy = await Promise.all(
    partShares.map((share) => chain.paidBy(payer, rewardPayerShareId(share)))
  );
  const owed = rewardSharesOwed(
    partShares.map((share, index) => {
      const who = paidBy[index] as Address;
      return { ...share, paidBy: isZeroAddress(who) ? null : who };
    }),
    safe
  );
  const ids = (shares: readonly RewardPayerShare[]) =>
    shares.map(rewardPayerShareId).sort().join(",");
  if (ids(owed) !== ids(shown)) return { status: "refused", refusal: "already-paid" };
  const total = shown.reduce((sum, share) => sum + share.amount, 0n);
  const [balance, state] = await Promise.all([chain.balance(token, safe), chain.safeState(safe)]);
  if (balance < total) return { status: "refused", refusal: "insufficient-balance" };
  const threshold = Number(state.threshold);
  if (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > state.owners.length) {
    return { status: "refused", refusal: "unreadable" };
  }
  const data = paymentCalldata(payer, token, total, shown);
  const hash = await chain.safeTransactionHash(safe, {
    to: REWARD_SAFE_MULTI_SEND,
    data,
    operation: DELEGATECALL,
    nonce: state.nonce,
  });
  const approved = await Promise.all(
    state.owners.map((owner) => chain.approvedHash(safe, owner, hash))
  );
  return {
    status: "ready",
    transaction: {
      safe,
      to: REWARD_SAFE_MULTI_SEND,
      data,
      operation: DELEGATECALL,
      nonce: state.nonce,
      hash,
    },
    owners: state.owners,
    threshold,
    approvedBy: state.owners.filter((_, index) => approved[index]),
    total,
    shareIds: shown.map(rewardPayerShareId),
  };
}

/**
 * The approvals `execTransaction` reads, one per signer in ascending address order: an owner who
 * approved the hash on chain, or the owner running it, each named with Safe's pre-approved form
 * (the owner as `r`, no `s`, and `v` of 1).
 */
function preApprovedSignatures(signers: readonly Address[]): Hex {
  const ordered = [...signers].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  const none: Hex = pad("0x", { size: 32 });
  return concat(
    ordered.map((owner): Hex => concat([pad(owner as Hex, { size: 32 }), none, "0x01"]))
  );
}

export type RewardPayStep = "approving" | "paying" | "confirming";

export type RewardPayOutcome =
  | { status: "paid"; transactionHash: Hex; shareIds: Hex[] }
  /** It went out but nobody can confirm it ran yet: it may still pay, and never twice. */
  | { status: "unconfirmed"; transactionHash: Hex | null; shareIds: Hex[] }
  /** This owner's approval went out; the payment waits for the Safe's other owners. */
  | { status: "approved"; approvals: number; threshold: number; confirmed: boolean }
  /** This owner had already approved; the payment waits for the Safe's other owners. */
  | { status: "awaiting-owners"; approvals: number; threshold: number }
  | { status: "refused-before-asking"; refusal: RewardPayRefusal }
  /** The approval or the payment didn't go through. */
  | { status: "not-paid"; miss: SeedCopyMiss };

/**
 * One owner's step towards paying the shown shares from the garden's Safe: their approval of the
 * payment, or, when theirs completes the threshold, the payment itself.
 */
export async function sendRewardSharePayment(input: {
  sender: TransactionSender;
  chain: RewardPayChain;
  chainId: number;
  payer: Address;
  safe: Address;
  /** The owner asking, from their own account. */
  account: Address;
  /** The step the owner pressed: their approval, or running the payment their call completes. */
  intent: "approve" | "pay";
  /** Every share of the part being paid, so a fresh read can tell which are still owed. */
  partShares: readonly RewardPayerShare[];
  /** The shares the steward was shown as owed and asked to pay. */
  shown: readonly RewardPayerShare[];
  /** Told as the payment moves. Report-only. */
  onStep?: (step: RewardPayStep) => void;
}): Promise<RewardPayOutcome> {
  const { sender, chainId, safe, account } = input;
  let read: RewardSafePaymentRead;
  try {
    read = await readRewardSafePayment(input);
  } catch (error) {
    logger.warn("Reward share payment reads failed before asking", { error, chainId });
    return { status: "refused-before-asking", refusal: "unreadable" };
  }
  if (read.status === "refused") return { status: "refused-before-asking", refusal: read.refusal };
  if (!read.owners.some((owner) => same(owner, account))) {
    return { status: "refused-before-asking", refusal: "not-an-owner" };
  }
  const { transaction, threshold, shareIds } = read;
  const others = read.approvedBy.filter((owner) => !same(owner, account));
  const completes = others.length + 1 >= threshold;
  if (completes !== (input.intent === "pay")) {
    return { status: "refused-before-asking", refusal: "approvals-changed" };
  }
  const step = (next: RewardPayStep) => {
    try {
      input.onStep?.(next);
    } catch {
      // A progress report never decides a payment.
    }
  };

  if (!completes) {
    if (read.approvedBy.some((owner) => same(owner, account))) {
      return { status: "awaiting-owners", approvals: read.approvedBy.length, threshold };
    }
    step("approving");
    let crossed = false;
    try {
      const approval = await sender.sendContractCall(
        {
          address: safe,
          account,
          abi: REWARD_SAFE_ABI as unknown as Abi,
          functionName: "approveHash",
          args: [transaction.hash],
          chainId,
        },
        { onBeforeBroadcast: async () => void (crossed = true) }
      );
      return {
        status: "approved",
        approvals: others.length + 1,
        threshold,
        confirmed: approval.confirmation !== "pending",
      };
    } catch (error) {
      if (crossed && mayStillLand(error)) {
        return { status: "approved", approvals: others.length + 1, threshold, confirmed: false };
      }
      return { status: "not-paid", miss: missOfSend(error, !crossed) };
    }
  }

  // This owner's call completes the threshold: it runs the payment, counting as their approval.
  step("paying");
  let crossed = false;
  try {
    const payment = await sender.sendContractCall(
      {
        address: safe,
        account,
        abi: REWARD_SAFE_ABI as unknown as Abi,
        functionName: "execTransaction",
        args: [
          transaction.to,
          0n,
          transaction.data,
          transaction.operation,
          0n,
          0n,
          0n,
          zeroAddress,
          zeroAddress,
          preApprovedSignatures([account, ...others.slice(0, threshold - 1)]),
        ],
        chainId,
      },
      {
        onBeforeBroadcast: async () => void (crossed = true),
        onBroadcast: async () => step("confirming"),
      }
    );
    const transactionHash = payment.hash as Hex;
    return payment.confirmation === "pending"
      ? { status: "unconfirmed", transactionHash, shareIds }
      : { status: "paid", transactionHash, shareIds };
  } catch (error) {
    // A payment past its receipt wait went out and may still land: it reads as unconfirmed,
    // never as failed. The payer would refuse a second payment of the same shares anyway.
    if (crossed && mayStillLand(error)) {
      const hash = (error as { hash?: unknown }).hash;
      return {
        status: "unconfirmed",
        transactionHash: typeof hash === "string" && hash.startsWith("0x") ? (hash as Hex) : null,
        shareIds,
      };
    }
    return { status: "not-paid", miss: missOfSend(error, !crossed) };
  }
}
