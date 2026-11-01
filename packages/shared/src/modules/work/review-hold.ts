import type { Hex } from "viem";
import { provenItems, settleOpenBatches } from "../transactions/batch-hold";
import type { BatchOperations } from "../transactions/batch-types";
import { type ReviewBatchInput, reviewDomain, verifyReviews } from "./review-batch";

/** Decisions whose last send has an unknown outcome. They stay held until it is settled. */
export interface ReviewHold {
  /** The sends this hold shows. Moving on ends only these, since a person has seen them. */
  operationIds: string[];
  workUIDs: string[];
  /** What EAS's index says now, for each work that could be read. */
  onChain: { workUID: string; decided: boolean }[];
}

/** A decision a read proved landed, with the hash that keeps it on screen until it's indexed. */
export interface ProvenReview {
  workUID: string;
  attestationUID?: Hex;
  transactionHash?: Hex;
}

export interface ReviewSettlement {
  hold: ReviewHold | null;
  saved: ProvenReview[];
  /** Works whose send ended without proof: reverted, never sent, or moved on from. */
  notLanded: string[];
}

async function settleOpenReviews(
  input: ReviewBatchInput,
  settle: BatchOperations["reconcile"],
  options: { shown?: ReviewHold | null; onlyShown?: boolean } = {}
): Promise<ReviewSettlement> {
  const { batches, scope, gardenAddress, chain } = input;
  const attestationUIDs = new Map<string, Hex>();
  const { held, ended } = await settleOpenBatches({
    batches,
    scope,
    domain: reviewDomain(gardenAddress),
    verifierFor: (prepared) => verifyReviews(prepared, input, attestationUIDs),
    settle,
    shownIds: options.shown?.operationIds,
    onlyShown: options.onlyShown,
  });
  const saved = ended.flatMap((record) =>
    provenItems(record).map(({ id }) => ({
      workUID: id,
      attestationUID: attestationUIDs.get(id),
      transactionHash: record.receipts[0]?.transactionHash,
    }))
  );
  const proven = new Set(saved.map(({ workUID }) => workUID));
  const notLanded = ended
    .flatMap((record) => record.prepared.items.map(({ id }) => id))
    .filter((id) => !proven.has(id));
  const workUIDs = held.flatMap((record) => record.prepared.items.map(({ id }) => id));
  if (workUIDs.length === 0) return { hold: null, saved, notLanded };

  const reads = await Promise.allSettled(workUIDs.map((workUID) => chain.isDecided(workUID)));
  return {
    hold: {
      operationIds: held.map((record) => record.id),
      workUIDs,
      onChain: reads.flatMap((read, index) =>
        read.status === "fulfilled" ? [{ workUID: workUIDs[index], decided: read.value }] : []
      ),
    },
    saved,
    notLanded,
  };
}

/** `shown` is the hold this tab last showed, so a send another tab ended still reports here. */
export function readReviewHold(input: ReviewBatchInput, shown?: ReviewHold | null) {
  return settleOpenReviews(input, input.batches.reconcile, { shown });
}

/** Call only for a person who has just seen what the chain says and chosen to move on. */
export function moveOnFromReviewHold(input: ReviewBatchInput, hold: ReviewHold) {
  // A work that could not be read has not been seen, so the hold stands until a read finds it.
  if (hold.onChain.length < hold.workUIDs.length) return readReviewHold(input, hold);
  return settleOpenReviews(input, input.batches.release, { shown: hold, onlyShown: true });
}
