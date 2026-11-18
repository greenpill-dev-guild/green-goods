/**
 * Editing a group's reward
 *
 * Edit Reward (PRD-1022 D14) gives every copy of a group that nobody has taken
 * the same new reward, until the first copy is kept. The contract lets the
 * pool steward change a commitment's terms only while it is offered or
 * requested (`TermsLib.setDeclaredConsideration`), so a taken copy keeps the
 * reward it was agreed at, and the group stays one row because its grouping
 * leaves the amount out.
 *
 * It is a direct act, like any other term edit: nothing is queued. The
 * contract checks only that the sender stewards the pool, so a passkey changes
 * a reward as a wallet does. A wallet that runs several calls as one
 * transaction is asked once, and so is a passkey where the enablement list
 * names its rail for reward edits; anyone else is asked once per copy, and
 * declining one leaves only that one as it was. A group past a passkey's
 * ceilings sends nothing and comes back `over-ceilings`, and the caller's next
 * try asks once per copy (`oneByOne`).
 *
 * Setting a reward to the amount it already has changes nothing, so trying
 * again is always safe. The sending itself is `copy-edit-send`'s, which Edit
 * Confirmers shares.
 *
 * @module modules/commitment-pooling/reward-edit
 */

import { zeroAddress } from "viem";
import type { Address } from "../../types/domain";
import { CommitmentPoolingModuleABI } from "../../utils/blockchain/contracts";
import type { BatchBudget } from "../transactions/batch-types";
import type { ContractCall, TransactionSender } from "../transactions/types";
import { type CopyEditProgress, type CopyEditStatus, sendCopyEdits } from "./copy-edit-send";
import { type CreationSendMode, copiesSendMode } from "./creation-send";
import { CONSIDERATION_RAIL_ORDINAL, type DeclaredConsiderationInput } from "./job-types";

/**
 * Copies changed per wallet approval. A term edit writes one struct where a
 * creation writes a whole commitment, so a group fits one approval; a larger
 * one is asked once per fifty.
 */
const REWARD_EDIT_BUNDLE_SIZE = 50;

/**
 * A passkey's ceilings for one bundle of reward edits, on the chains they were measured on. On a
 * fork of Arbitrum (block 520,827,637, 2026-11-03), fifty edits took 3.8M gas from the steward's
 * own address and 17.8 KB of Kernel calldata, and a Green Goods passkey UserOperation adds about
 * 730k for validation and sponsorship. The first live bundle confirms them before the rail is
 * listed. A wallet sets its own limits.
 */
const REWARD_EDIT_BUDGETS: Partial<Record<number, BatchBudget>> = {
  42161: {
    maxCalls: REWARD_EDIT_BUNDLE_SIZE,
    maxCalldataBytes: 20_480,
    maxGas: "8000000",
    maxFeePerGas: "1000000000",
    maxFee: "2000000000000000",
    sponsorship: "required",
  },
};

export function rewardEditBudget(chainId: number): BatchBudget | null {
  return REWARD_EDIT_BUDGETS[chainId] ?? null;
}

/** How Edit Reward asks: once per group where the sender can, otherwise once per copy. */
export function rewardEditSendMode(
  sender: TransactionSender | null,
  chainId: number
): Promise<CreationSendMode> {
  return copiesSendMode(sender, chainId, "reward-edits", rewardEditBudget(chainId));
}

/** Where one copy of a reward edit stands; the same shape every term edit reports. */
export type RewardEditStatus = CopyEditStatus;
export type RewardEditProgress = CopyEditProgress;

/** A reward in G$ on the Celo settlement rail, or no reward at all for zero. */
export function goodDollarConsideration(amount: bigint): DeclaredConsiderationInput {
  const zero = zeroAddress as Address;
  return amount > 0n
    ? { rail: CONSIDERATION_RAIL_ORDINAL.CELO_SETTLEMENT, source: zero, token: zero, amount }
    : { rail: CONSIDERATION_RAIL_ORDINAL.NONE, source: zero, token: zero, amount: 0n };
}

export async function sendRewardEdit(input: {
  sender: TransactionSender | null;
  chainId: number;
  moduleAddress: Address;
  /** The copies nobody has taken; the contract refuses any other. */
  commitmentIds: readonly bigint[];
  consideration: DeclaredConsiderationInput;
  /** Told each time a copy moves. Report-only: a throw here never reaches a send. */
  onCopy?: (progress: RewardEditProgress) => void;
  /**
   * Ask once per copy even where the wallet could take the group: an earlier
   * group was past its ceilings, and the count said up front follows that.
   */
  oneByOne?: boolean;
}): Promise<RewardEditProgress[]> {
  const { sender, chainId, moduleAddress, consideration } = input;
  const probed = await rewardEditSendMode(sender, chainId);
  return sendCopyEdits({
    sender,
    mode: probed === "bundle" && input.oneByOne ? "one-by-one" : probed,
    commitmentIds: input.commitmentIds,
    callFor: (commitmentId: bigint): ContractCall => ({
      address: moduleAddress,
      abi: CommitmentPoolingModuleABI,
      functionName: "setDeclaredConsideration",
      args: [commitmentId, consideration],
      chainId,
    }),
    bundleSize: REWARD_EDIT_BUNDLE_SIZE,
    batchBudget: rewardEditBudget(chainId),
    onCopy: input.onCopy,
  });
}
