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
 * It is a direct act, like any other term edit: nothing is queued. A wallet
 * that runs several calls as one transaction is asked once; any other wallet
 * is asked once per copy, and declining one leaves only that one as it was.
 * Setting a reward to the amount it already has changes nothing, so trying
 * again is always safe.
 *
 * @module modules/commitment-pooling/reward-edit
 */

import { zeroAddress } from "viem";
import type { Address } from "../../types/domain";
import { CommitmentPoolingModuleABI } from "../../utils/blockchain/contracts";
import { classifyTxError } from "../../utils/errors/tx-error-classifier";
import { logger } from "../app/logger";
import type { ContractCall, TransactionSender } from "../transactions/types";
import { creationSendMode } from "./creation-send";
import { CONSIDERATION_RAIL_ORDINAL, type DeclaredConsiderationInput } from "./job-types";
import { chunkCopies, type SeedCopyMiss } from "./seed-sets";

/**
 * Copies changed per wallet approval. A term edit writes one struct where a
 * creation writes a whole commitment, so a group fits one approval; a larger
 * one is asked once per fifty.
 */
const REWARD_EDIT_BUNDLE_SIZE = 50;

export type RewardEditStatus = "waiting" | "wallet" | "confirming" | "changed" | "not-changed";

export interface RewardEditProgress {
  commitmentId: bigint;
  status: RewardEditStatus;
  /** Why it wasn't changed: declined and refused left it as it was; failed may not have. */
  miss?: SeedCopyMiss;
  txHash: string | null;
}

/** A reward in G$ on the Celo settlement rail, or no reward at all for zero. */
export function goodDollarConsideration(amount: bigint): DeclaredConsiderationInput {
  const zero = zeroAddress as Address;
  return amount > 0n
    ? { rail: CONSIDERATION_RAIL_ORDINAL.CELO_SETTLEMENT, source: zero, token: zero, amount }
    : { rail: CONSIDERATION_RAIL_ORDINAL.NONE, source: zero, token: zero, amount: 0n };
}

function missOf(error: unknown): SeedCopyMiss {
  const { kind } = classifyTxError(error);
  if (kind === "cancelled") return "declined";
  if (kind === "reverted") return "refused";
  return "failed";
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
}): Promise<RewardEditProgress[]> {
  const { sender, chainId, moduleAddress, consideration } = input;
  const progress = new Map<bigint, RewardEditProgress>(
    input.commitmentIds.map((commitmentId) => [
      commitmentId,
      { commitmentId, status: "waiting", txHash: null },
    ])
  );
  const tell = (commitmentId: bigint, patch: Partial<RewardEditProgress>) => {
    const next = { ...(progress.get(commitmentId) as RewardEditProgress), ...patch };
    progress.set(commitmentId, next);
    try {
      input.onCopy?.(next);
    } catch (error) {
      logger.warn("[reward-edit] a progress report threw", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const callFor = (commitmentId: bigint): ContractCall => ({
    address: moduleAddress,
    abi: CommitmentPoolingModuleABI,
    functionName: "setDeclaredConsideration",
    args: [commitmentId, consideration],
    chainId,
  });

  const mode = await creationSendMode(sender, chainId);
  if (!sender || mode === "background") {
    // The steward cockpit signs with a wallet; anything else can't change terms from here.
    for (const commitmentId of input.commitmentIds) {
      tell(commitmentId, { status: "not-changed", miss: "refused" });
    }
  } else if (mode === "bundle" && sender.sendAtomicBatch) {
    for (const ids of chunkCopies(input.commitmentIds, REWARD_EDIT_BUNDLE_SIZE)) {
      for (const commitmentId of ids) tell(commitmentId, { status: "wallet" });
      try {
        const result = await sender.sendAtomicBatch(ids.map(callFor), {
          onAccepted: async () => {
            for (const commitmentId of ids) tell(commitmentId, { status: "confirming" });
          },
        });
        for (const commitmentId of ids) {
          tell(commitmentId, { status: "changed", txHash: result.hash });
        }
      } catch (error) {
        const miss = missOf(error);
        for (const commitmentId of ids) tell(commitmentId, { status: "not-changed", miss });
      }
    }
  } else {
    for (const commitmentId of input.commitmentIds) {
      tell(commitmentId, { status: "wallet" });
      try {
        const result = await sender.sendContractCall(callFor(commitmentId), {
          onBroadcast: async (hash) => tell(commitmentId, { status: "confirming", txHash: hash }),
        });
        tell(commitmentId, { status: "changed", txHash: result.hash });
      } catch (error) {
        tell(commitmentId, { status: "not-changed", miss: missOf(error) });
      }
    }
  }
  return input.commitmentIds.map(
    (commitmentId) => progress.get(commitmentId) as RewardEditProgress
  );
}
