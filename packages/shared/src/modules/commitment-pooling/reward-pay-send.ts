/**
 * Paying a promise's wallet-paid shares
 *
 * A steward pays the shares of a reward part, USDC for the pilot, from their own
 * wallet through the reward payer (PRD-1556). Before anything is asked, a fresh
 * read has to show that the part still owes exactly the shares the steward was
 * shown, none paid and none kept since, and that the wallet holds their total:
 * the payer refuses a paid share, and the token refuses an amount the wallet
 * doesn't hold, so either would only cost a signature. Then it is one
 * approval for exactly the total, skipped only when the allowance already is
 * exactly that, so a steward never leaves more approved than a payment moves;
 * and one call that pays every share or none.
 *
 * These go as two sends. A passkey can join them into one only once its rail is
 * listed in `batch-enablement`, which needs a live batch first.
 *
 * @module modules/commitment-pooling/reward-pay-send
 */

import { readContract } from "@wagmi/core";
import type { Abi, Hex } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { logger } from "../app/logger";
import type { Address } from "../../types/domain";
import { ERC20_ALLOWANCE_ABI, ERC20_BALANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { isZeroAddress } from "../../utils/blockchain/address";
import type { ContractCall, TransactionSender } from "../transactions/types";
import { mayStillLand } from "../../utils/errors/tx-error-classifier";
import { missOfSend } from "./creation-send";
import {
  REWARD_PAYER_ABI,
  type RewardPayerShare,
  rewardPayerShareId,
  rewardSharesOwed,
} from "./reward-payer";
import type { SeedCopyMiss } from "./seed-sets";

/** How a payment reads the payout chain. */
export interface RewardPayChain {
  allowance(token: Address, owner: Address, spender: Address): Promise<bigint>;
  balance(token: Address, owner: Address): Promise<bigint>;
  /** Who paid a share; the zero address while it is unpaid. */
  paidBy(payer: Address, shareId: Hex): Promise<Address>;
}

/** The payout chain as the app's wallet configuration reads it. */
export function createRewardPayChain(chainId: number): RewardPayChain {
  const read = <T>(request: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: unknown[];
  }) => readContract(getWagmiConfig(), { ...request, chainId }) as Promise<T>;
  return {
    allowance: (token, owner, spender) =>
      read<bigint>({
        address: token,
        abi: ERC20_ALLOWANCE_ABI as unknown as Abi,
        functionName: "allowance",
        args: [owner, spender],
      }),
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
  };
}

/** Why a payment wasn't asked for, read before any signature. */
type RewardPayRefusal =
  | "no-shares"
  | "mixed-tokens"
  | "self-payment"
  /** A share was paid or kept since the steward read the list: what is owed has changed. */
  | "already-paid"
  | "insufficient-balance"
  /** A read before asking failed, so nothing was asked for. */
  | "unreadable";

export type RewardPayStep = "approving" | "paying" | "confirming";

export type RewardPayOutcome =
  | { status: "paid"; transactionHash: Hex; shareIds: Hex[] }
  /** It went out but nobody can confirm it ran yet: it may still pay, and never twice. */
  | { status: "unconfirmed"; transactionHash: Hex | null; shareIds: Hex[] }
  /** The approval went to the wallet as a proposal; paying waits until it runs. */
  | { status: "approval-pending" }
  | { status: "refused-before-asking"; refusal: RewardPayRefusal }
  /** The approval or the payment didn't go through; an approval that did is harmless. */
  | { status: "not-paid"; miss: SeedCopyMiss; approved: boolean };

const payAllCall = (
  payer: Address,
  account: Address,
  shares: readonly RewardPayerShare[],
  chainId: number
) =>
  ({
    address: payer,
    account,
    abi: REWARD_PAYER_ABI as unknown as Abi,
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
    chainId,
  }) satisfies ContractCall;

/**
 * Whether the shown shares can be paid from `account` now, read before asking; null when they
 * can. They must be in the part's one token and owed to someone other than the payer. Read
 * afresh, the part must still owe exactly them: none paid, and none kept by a steward who paid
 * the rest since the list was read. The wallet must hold their total.
 */
async function rewardPayRefusal(input: {
  chain: RewardPayChain;
  payer: Address;
  account: Address;
  partShares: readonly RewardPayerShare[];
  shown: readonly RewardPayerShare[];
}): Promise<RewardPayRefusal | null> {
  const { chain, payer, account, partShares, shown } = input;
  const [first] = shown;
  if (!first) return "no-shares";
  const token = first.token.toLowerCase();
  if (partShares.some((share) => share.token.toLowerCase() !== token)) return "mixed-tokens";
  // The payer refuses a payment to oneself, and payAll would take every other share down with it.
  if (shown.some((share) => share.recipient.toLowerCase() === account.toLowerCase())) {
    return "self-payment";
  }
  const paidBy = await Promise.all(
    partShares.map((share) => chain.paidBy(payer, rewardPayerShareId(share)))
  );
  const owed = rewardSharesOwed(
    partShares.map((share, index) => {
      const who = paidBy[index] as Address;
      return { ...share, paidBy: isZeroAddress(who) ? null : who };
    }),
    account
  );
  const ids = (shares: readonly RewardPayerShare[]) =>
    shares.map(rewardPayerShareId).sort().join(",");
  if (ids(owed) !== ids(shown)) return "already-paid";
  const total = shown.reduce((sum, share) => sum + share.amount, 0n);
  return (await chain.balance(first.token, account)) < total ? "insufficient-balance" : null;
}

export async function sendRewardSharePayment(input: {
  sender: TransactionSender;
  chain: RewardPayChain;
  chainId: number;
  payer: Address;
  account: Address;
  /** Every share of the part being paid, so a fresh read can tell which are still owed. */
  partShares: readonly RewardPayerShare[];
  /** The shares the steward was shown as owed and asked to pay. */
  shown: readonly RewardPayerShare[];
  /** Told as the payment moves. Report-only. */
  onStep?: (step: RewardPayStep) => void;
}): Promise<RewardPayOutcome> {
  const { sender, chain, chainId, payer, account, partShares, shown: shares } = input;
  let allowance: bigint;
  try {
    const refusal = await rewardPayRefusal({ chain, payer, account, partShares, shown: shares });
    if (refusal) return { status: "refused-before-asking", refusal };
    allowance = await chain.allowance((shares[0] as RewardPayerShare).token, account, payer);
  } catch (error) {
    logger.warn("Reward share payment reads failed before asking", { error, chainId });
    return { status: "refused-before-asking", refusal: "unreadable" };
  }
  const token = (shares[0] as RewardPayerShare).token;
  const total = shares.reduce((sum, share) => sum + share.amount, 0n);
  const shareIds = shares.map(rewardPayerShareId);
  const step = (next: RewardPayStep) => {
    try {
      input.onStep?.(next);
    } catch {
      // A progress report never decides a payment.
    }
  };

  let approved = false;
  // The steward approves exactly what this payment moves, never more (the 2.1.0 waiver's
  // condition): an allowance left at any other amount is set to the total first.
  if (allowance !== total) {
    step("approving");
    let crossed = false;
    try {
      const approval = await sender.sendContractCall(
        {
          address: token,
          account,
          abi: ERC20_ALLOWANCE_ABI as unknown as Abi,
          functionName: "approve",
          args: [payer, total],
          chainId,
        },
        { onBeforeBroadcast: async () => void (crossed = true) }
      );
      // An approval nobody can confirm yet leaves the payment to wait for it.
      if (approval.confirmation === "pending") return { status: "approval-pending" };
      approved = true;
    } catch (error) {
      return { status: "not-paid", miss: missOfSend(error, !crossed), approved: false };
    }
  }

  step("paying");
  let crossed = false;
  try {
    const payment = await sender.sendContractCall(payAllCall(payer, account, shares, chainId), {
      onBeforeBroadcast: async () => void (crossed = true),
      onBroadcast: async () => step("confirming"),
    });
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
    return { status: "not-paid", miss: missOfSend(error, !crossed), approved };
  }
}
