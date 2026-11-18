/**
 * Sending one term edit per copy
 *
 * Edit Reward and Edit Confirmers both rewrite a term on every copy nobody has
 * taken, one contract call per copy, because the contract lets a pool steward
 * change terms only while a commitment is offered or requested. This sends
 * those calls the way the caller's send mode says: as bundles where the sender
 * runs several calls as one transaction, otherwise once per copy, so declining
 * one leaves only that one as it was. It reports where each copy stands as it
 * moves.
 *
 * A Safe-style wallet can hand back an id with no receipt to check: the change
 * may still run, or never, so it reads as not confirmed, never as changed.
 *
 * @module modules/commitment-pooling/copy-edit-send
 */

import type { BatchBudget } from "../transactions/batch-types";
import type { ContractCall, TransactionSender } from "../transactions/types";
import { logger } from "../app/logger";
import { type CreationSendMode, missOfSend } from "./creation-send";
import { chunkCopies, type SeedCopyMiss } from "./seed-sets";

export type CopyEditStatus = "waiting" | "wallet" | "confirming" | "changed" | "not-changed";

export interface CopyEditProgress {
  commitmentId: bigint;
  status: CopyEditStatus;
  /** Why it wasn't changed: declined and refused left it as it was; failed may not have. */
  miss?: SeedCopyMiss;
  txHash: string | null;
}

/** A send the wallet took but nobody can confirm yet: not changed, and possibly changed later. */
const UNCONFIRMED = { status: "not-changed", miss: "failed" } as const;

export async function sendCopyEdits(input: {
  sender: TransactionSender | null;
  /** How the caller decided to ask; `background` sends nothing from here. */
  mode: CreationSendMode;
  /** The copies nobody has taken; the contract refuses any other. */
  commitmentIds: readonly bigint[];
  /** The one call that edits a copy. */
  callFor: (commitmentId: bigint) => ContractCall;
  /** Copies per wallet approval when bundling. */
  bundleSize: number;
  /** A passkey's ceilings for one bundle; a wallet sets its own limits. */
  batchBudget: BatchBudget | null;
  /** Told each time a copy moves. Report-only: a throw here never reaches a send. */
  onCopy?: (progress: CopyEditProgress) => void;
}): Promise<CopyEditProgress[]> {
  const { sender, mode, callFor } = input;
  const progress = new Map<bigint, CopyEditProgress>(
    input.commitmentIds.map((commitmentId) => [
      commitmentId,
      { commitmentId, status: "waiting", txHash: null },
    ])
  );
  const tell = (commitmentId: bigint, patch: Partial<CopyEditProgress>) => {
    const next = { ...(progress.get(commitmentId) as CopyEditProgress), ...patch };
    progress.set(commitmentId, next);
    try {
      input.onCopy?.(next);
    } catch (error) {
      logger.warn("[copy-edit-send] a progress report threw", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (!sender || mode === "background") {
    // An embedded account can't change terms from here.
    for (const commitmentId of input.commitmentIds) {
      tell(commitmentId, { status: "not-changed", miss: "refused" });
    }
  } else if (mode === "bundle" && sender.sendAtomicBatch) {
    const batchBudget = sender.authMode === "passkey" ? input.batchBudget : null;
    for (const ids of chunkCopies(input.commitmentIds, input.bundleSize)) {
      for (const commitmentId of ids) tell(commitmentId, { status: "wallet" });
      let neverSent = false;
      try {
        const result = await sender.sendAtomicBatch(ids.map(callFor), {
          ...(batchBudget ? { batchBudget } : {}),
          onAccepted: async () => {
            for (const commitmentId of ids) tell(commitmentId, { status: "confirming" });
          },
          onNeverSent: () => {
            neverSent = true;
          },
        });
        for (const commitmentId of ids) {
          tell(commitmentId, {
            ...(result.confirmation === "pending" ? UNCONFIRMED : { status: "changed" }),
            txHash: result.hash,
          });
        }
      } catch (error) {
        const miss = missOfSend(error, neverSent);
        for (const commitmentId of ids) tell(commitmentId, { status: "not-changed", miss });
      }
    }
  } else {
    for (const commitmentId of input.commitmentIds) {
      tell(commitmentId, { status: "wallet" });
      // Until the call can go out, a failure leaves the copy as it was.
      let crossed = false;
      try {
        const result = await sender.sendContractCall(callFor(commitmentId), {
          onBeforeBroadcast: async () => {
            crossed = true;
          },
          onBroadcast: async (hash) => tell(commitmentId, { status: "confirming", txHash: hash }),
        });
        tell(commitmentId, {
          ...(result.confirmation === "pending" ? UNCONFIRMED : { status: "changed" }),
          txHash: result.hash,
        });
      } catch (error) {
        tell(commitmentId, { status: "not-changed", miss: missOfSend(error, !crossed) });
      }
    }
  }
  return input.commitmentIds.map((commitmentId) => progress.get(commitmentId) as CopyEditProgress);
}
