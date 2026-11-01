import type { Hex } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { Address, WorkApprovalDraft } from "../../types/domain";
import { EASABI } from "../../utils/blockchain/contracts";
import { encodeWorkApprovalData } from "../../utils/eas/encoders";
import { buildQueuedAttestationsCall } from "../../utils/eas/transaction-builder";
import type { BatchRail } from "../transactions/batch-enablement";
import { provenItems, settleOpenBatches, verifyByReading } from "../transactions/batch-hold";
import {
  type BatchOperations,
  type BatchReceipt,
  type BatchScope,
  type PreparedBatch,
  UNKNOWN_BATCH_STATES,
  type VerifyBatchItems,
} from "../transactions/batch-types";
import { onlyFunction, prepareBatch } from "../transactions/prepared-batch";
import type { ContractCall } from "../transactions/types";
import {
  MAX_REVIEWS_PER_SIGNATURE,
  type ReviewAttestation,
  type ReviewChain,
  reviewBudget,
  signaturesForReviews,
} from "./review-chain";

/** One reviewed decision. Every field a send encodes comes from the person's own review. */
export interface ReviewDecision {
  draft: WorkApprovalDraft;
  gardenAddress: Address;
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

export const reviewDomain = (gardenAddress: Address) => `review:${gardenAddress.toLowerCase()}`;

/** Every attempt on a work shares this ID, which is what makes an unknown one hold the next. */
const itemId = (workUID: string) => workUID.toLowerCase();

function reviewCall(decisions: readonly ReviewDecision[], chainId: number): ContractCall {
  const eas = getEASConfig(chainId);
  const call = buildQueuedAttestationsCall(
    eas.EAS.address as Hex,
    decisions.map(({ draft, gardenAddress }) => ({
      schema: eas.WORK_APPROVAL.uid as Hex,
      gardenAddress: gardenAddress as Hex,
      attestationData: encodeWorkApprovalData(draft, chainId),
    }))
  );
  return { ...call, abi: onlyFunction(EASABI, call.functionName) };
}

export function prepareReviewBatch(input: {
  id: string;
  account: Address;
  chainId: number;
  gardenAddress: Address;
  rail: BatchRail;
  decisions: readonly ReviewDecision[];
}): PreparedBatch {
  const budget = reviewBudget(input.rail, input.chainId);
  if (!budget) throw new Error("batch-budget-required");
  const call = reviewCall(input.decisions, input.chainId);
  return prepareBatch({
    id: input.id,
    account: input.account,
    chainId: input.chainId,
    domain: reviewDomain(input.gardenAddress),
    mode: "single-call",
    budget,
    items: input.decisions.map(({ draft }) => ({ id: itemId(draft.workUID), call })),
  });
}

interface SentRequest {
  recipient: Address;
  data: Hex;
}

/** What a prepared call asked EAS for this work, read back so a reload proves the same thing. */
function sentFor(prepared: PreparedBatch, id: string): SentRequest | undefined {
  const index = prepared.items.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  const { functionName, args = [] } = prepared.items[index].call;
  return functionName === "attest"
    ? (args[0] as { data: SentRequest }).data
    : (args[0] as readonly { data: readonly SentRequest[] }[])[0].data[index];
}

interface ReviewBatchInput {
  batches: BatchOperations;
  scope: BatchScope;
  gardenAddress: Address;
  chain: ReviewChain;
  retryMs?: number;
}

/**
 * A receipt says a transaction ran, not what it decided, so only an attestation this account made
 * for this garden, carrying exactly the data that was sent, proves a decision. It also names the
 * attestation that holds it, whatever order the reads come back in.
 */
function verifyReviews(
  prepared: PreparedBatch,
  { chain, retryMs }: Pick<ReviewBatchInput, "chain" | "retryMs">,
  attestationUIDs: Map<string, Hex>
): VerifyBatchItems {
  const read = new Map<Hex, readonly ReviewAttestation[]>();
  const madeIn = async (receipts: readonly BatchReceipt[]) => {
    const found = await Promise.all(
      receipts.map(async ({ transactionHash: hash }) => {
        // A node can answer from before the receipt's block, so a failed read is another try.
        const made = read.get(hash) ?? (await chain.attestationsIn(hash).catch(() => null));
        if (made) read.set(hash, made);
        return made ?? [];
      })
    );
    return found.flat();
  };
  return (execution) => {
    const isProven = async (id: string) => {
      const sent = sentFor(prepared, id);
      if (!sent) return false;
      const match = (await madeIn(execution.receipts)).find(
        (made) =>
          same(made.attester, prepared.account) &&
          same(made.recipient, sent.recipient) &&
          same(made.data, sent.data)
      );
      if (match) attestationUIDs.set(id, match.uid);
      return Boolean(match);
    };
    return verifyByReading(isProven, retryMs)(execution);
  };
}

export interface SentReview {
  workUID: string;
  attestationUID: Hex;
  transactionHash: Hex;
}

export interface ReviewBatchOutcome {
  sent: SentReview[];
  /** Someone decided these since they were reviewed, so they go back to review. */
  stale: string[];
  /** The chain would refuse these. Nothing is sent until the person changes the list. */
  refused: { workUID: string; reason: string }[];
  /** Nothing went out for these, and they can go again as they are. */
  notSent: string[];
  /** Nothing went out for these: past the ceilings, they need more signatures than promised. */
  notBatchable: string[];
  /** They may have landed: held until someone reads them or moves on. */
  unknown: string[];
  /** Why a send stopped before going out, when that is more than a declined signature. */
  failure?: unknown;
}

const NOT_BATCHABLE = new Set(["batch-budget-exceeded", "batch-atomic-unavailable"]);

/**
 * Send every decision, one signature per group. Everything is checked before anything is signed,
 * because one decision the resolver refuses reverts its whole call. Earlier groups stay sent when a
 * later one stops, since each is its own transaction.
 */
export async function sendReviewBatch(
  input: ReviewBatchInput & {
    rail: BatchRail;
    decisions: readonly ReviewDecision[];
    onLanded?: (sent: readonly SentReview[]) => void;
  }
): Promise<ReviewBatchOutcome> {
  const { batches, scope, gardenAddress, chain, rail, onLanded } = input;
  const decisions = [
    ...new Map(
      input.decisions.map((decision) => [itemId(decision.draft.workUID), decision])
    ).values(),
  ];
  const uids = (list: readonly ReviewDecision[]) => list.map(({ draft }) => draft.workUID);
  const outcome: ReviewBatchOutcome = {
    sent: [],
    stale: [],
    refused: [],
    notSent: [],
    notBatchable: [],
    unknown: [],
  };

  let decided: boolean[];
  try {
    decided = await Promise.all(decisions.map(({ draft }) => chain.isDecided(draft.workUID)));
  } catch (failure) {
    // Unknown is not "no": a second decision still runs the resolver's hooks.
    return { ...outcome, notSent: uids(decisions), failure };
  }
  outcome.stale = uids(decisions.filter((_, index) => decided[index]));
  const fresh = decisions.filter((_, index) => !decided[index]);
  if (outcome.stale.length > 0) return { ...outcome, notSent: uids(fresh) };

  const groups = Array.from({ length: signaturesForReviews(fresh.length) }, (_, index) =>
    fresh.slice(index * MAX_REVIEWS_PER_SIGNATURE, (index + 1) * MAX_REVIEWS_PER_SIGNATURE)
  );

  for (const group of groups) {
    const refusal = await chain.refusal(reviewCall(group, scope.chainId), scope.account);
    if (!refusal) continue;
    const alone = await Promise.all(
      group.map(async (decision) => ({
        workUID: decision.draft.workUID,
        reason: await chain.refusal(reviewCall([decision], scope.chainId), scope.account),
      }))
    );
    const refused = alone.flatMap(({ workUID, reason }) => (reason ? [{ workUID, reason }] : []));
    // The call is refused but no single decision is: nothing is sent blind.
    if (refused.length === 0) {
      return { ...outcome, notSent: uids(fresh), failure: new Error(refusal) };
    }
    outcome.refused.push(...refused);
  }
  if (outcome.refused.length > 0) {
    const refusedIds = new Set(outcome.refused.map(({ workUID }) => workUID));
    return { ...outcome, notSent: uids(fresh).filter((workUID) => !refusedIds.has(workUID)) };
  }

  for (const [index, group] of groups.entries()) {
    const remaining = uids(groups.slice(index).flat());
    try {
      const prepared = prepareReviewBatch({
        ...scope,
        id: crypto.randomUUID(),
        gardenAddress,
        rail,
        decisions: group,
      });
      const attestationUIDs = new Map<string, Hex>();
      const record = await batches.execute(prepared, {
        // A role or an action's end can pass while a list is open, and the last signature may be a
        // while ago.
        preflight: async () => {
          const reason = await chain.refusal(reviewCall(group, scope.chainId), scope.account);
          if (reason) throw new Error(reason);
        },
        verify: verifyReviews(prepared, input, attestationUIDs),
      });
      if (record.status === "confirmed") {
        const transactionHash = record.receipts[0].transactionHash;
        const sent = group.map(({ draft: { workUID } }) => ({
          workUID,
          attestationUID: attestationUIDs.get(itemId(workUID)) as Hex,
          transactionHash,
        }));
        outcome.sent.push(...sent);
        onLanded?.(sent);
        continue;
      }
      if (UNKNOWN_BATCH_STATES.has(record.status)) {
        return { ...outcome, unknown: uids(group), notSent: uids(groups.slice(index + 1).flat()) };
      }
      return { ...outcome, notSent: remaining };
    } catch (error) {
      if (error instanceof Error && NOT_BATCHABLE.has(error.message)) {
        return { ...outcome, notBatchable: remaining };
      }
      return { ...outcome, notSent: remaining, failure: error };
    }
  }
  return outcome;
}

/** Decisions whose last send has an unknown outcome. They stay held until it is settled. */
export interface ReviewHold {
  /** The sends this hold shows. Moving on ends only these, since a person has seen them. */
  operationIds: string[];
  workUIDs: string[];
  /** What EAS's index says now, for each work that could be read. */
  onChain: { workUID: string; decided: boolean }[];
}

/** A decision a read proved landed. The hash comes only from the tab that ended it. */
export interface ProvenReview {
  workUID: string;
  attestationUID?: Hex;
  transactionHash?: Hex;
}

async function settleOpenReviews(
  input: ReviewBatchInput,
  settle: BatchOperations["reconcile"],
  options: { shown?: ReviewHold | null; onlyShown?: boolean } = {}
): Promise<{ hold: ReviewHold | null; saved: ProvenReview[] }> {
  const { batches, scope, gardenAddress, chain } = input;
  const attestationUIDs = new Map<string, Hex>();
  const { held, ended, endedHere } = await settleOpenBatches({
    batches,
    scope,
    domain: reviewDomain(gardenAddress),
    verifierFor: (prepared) => verifyReviews(prepared, input, attestationUIDs),
    settle,
    shownIds: options.shown?.operationIds,
    onlyShown: options.onlyShown,
  });
  const saved = ended.flatMap((record) => {
    const here = endedHere.includes(record);
    return provenItems(record).map(({ id }) => ({
      workUID: id,
      attestationUID: attestationUIDs.get(id),
      transactionHash: here ? record.receipts[0]?.transactionHash : undefined,
    }));
  });
  const workUIDs = held.flatMap((record) => record.prepared.items.map(({ id }) => id));
  if (workUIDs.length === 0) return { hold: null, saved };

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
