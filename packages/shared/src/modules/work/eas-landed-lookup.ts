/**
 * Whether a work or a decision whose send lost its answer reached the chain
 *
 * A work carries its client work id in its metadata, and a decision names the
 * work it decides, so the person's own attestations, as EAS's indexer holds
 * them, settle a send no receipt can. "Found" needs the landed attestation:
 * for a decision, one that carries every field its send encodes.
 * "Absent" needs more than an empty answer: EAS must have processed a block,
 * timed on the chain itself, past the send's grace window (`indexer-coverage`).
 * EAS writes a block range's attestations before it moves its processed block,
 * so that block is read first. Short of that the answer is "unknown", which
 * keeps the send waiting.
 *
 * @module modules/work/eas-landed-lookup
 */

import type { Hex } from "viem";
import type { WorkApprovalDraft } from "../../types/domain";
import type { EASWorkApproval } from "../../types/eas-responses";
import { logger } from "../app/logger";
import { resolveDeferredWorkIdentity } from "../commitment-pooling/work-identity";
import {
  getEasIndexedBlock,
  getWorkDecisionsSince,
  getWorkSubmissionsSince,
} from "../data/eas-sent-attestations";
import { chainBlockTime, indexedPastGraceWindow, type ReadBlockTime } from "./indexer-coverage";
import {
  STRANDED_INTENT_GRACE_MS,
  type StrandedDecisionLookup,
  type StrandedLookupResult,
  type StrandedWorkLookup,
} from "./stranded-intent";

interface EasLookupDependencies {
  submissions?: typeof getWorkSubmissionsSince;
  decisions?: typeof getWorkDecisionsSince;
  /** The last block EAS's indexer processed on a chain, or null when it cannot say. */
  readIndexedBlock?: (chainId: number) => Promise<bigint | null>;
  readBlockTime?: ReadBlockTime;
  now?: () => number;
}

export interface EasLandedLookup {
  work: StrandedWorkLookup;
  decision: StrandedDecisionLookup;
}

/**
 * Whether a landed decision is the one a send of this draft encodes. The
 * encoder writes a missing text as an empty one.
 */
function sameDecision(made: EASWorkApproval, sent: WorkApprovalDraft): boolean {
  return (
    made.workUID.toLowerCase() === sent.workUID.toLowerCase() &&
    made.actionUID === sent.actionUID &&
    made.approved === sent.approved &&
    made.feedback === (sent.feedback ?? "") &&
    made.confidence === sent.confidence &&
    made.verificationMethod === sent.verificationMethod &&
    made.reviewNotesCID === (sent.reviewNotesCID ?? "")
  );
}

export function createEasLandedLookup(deps: EasLookupDependencies = {}): EasLandedLookup {
  // Each read is found when a lookup runs it, so a work's lookup never needs the decisions'.
  const submissions: typeof getWorkSubmissionsSince = (input) =>
    (deps.submissions ?? getWorkSubmissionsSince)(input);
  const decisions: typeof getWorkDecisionsSince = (input) =>
    (deps.decisions ?? getWorkDecisionsSince)(input);
  const readIndexedBlock = deps.readIndexedBlock ?? ((chainId) => getEasIndexedBlock(chainId));
  const readBlockTime = deps.readBlockTime ?? chainBlockTime;
  const now = deps.now ?? Date.now;

  /** How far EAS has indexed, read before any attestation; null when it cannot say. */
  async function indexedBlock(chainId: number): Promise<bigint | null> {
    try {
      return await readIndexedBlock(chainId);
    } catch (error) {
      logger.warn("[StrandedIntent] Could not read how far EAS has indexed", { chainId, error });
      return null;
    }
  }

  /**
   * An empty answer proves absence only once EAS has processed past the grace
   * window, and past the block where the send was last found idle.
   */
  async function absentOnceCovered(
    chainId: number,
    indexed: bigint | null,
    send: { sentAtMs: number; intentChainTime?: number; idleBlock?: bigint }
  ): Promise<StrandedLookupResult> {
    const { sentAtMs, intentChainTime, idleBlock } = send;
    if (indexed === null) return { status: "unknown" };
    // Anything the send did before it was found idle landed by that block.
    if (idleBlock !== undefined && indexed < idleBlock) return { status: "unknown" };
    // Timed on the chain's clock when the send kept it, since the device's clock
    // may since have moved either way, and on the device's clock otherwise.
    if (intentChainTime === undefined && now() - sentAtMs < STRANDED_INTENT_GRACE_MS)
      return { status: "unknown" };
    const covered = await indexedPastGraceWindow({
      chainId,
      indexedBlock: indexed,
      sentAtMs,
      intentChainTime,
      readBlockTime,
      now,
    });
    return covered ? { status: "absent" } : { status: "unknown" };
  }

  const work: StrandedWorkLookup = async ({
    sinceMs,
    sentAtMs,
    intentChainTime,
    idleBlock,
    ...input
  }) => {
    const indexed = await indexedBlock(input.chainId);
    const transactionHashes = new Map<string, Hex | undefined>();
    const identity = await resolveDeferredWorkIdentity({
      ...input,
      dependencies: {
        getWorksByGardener: async () => {
          const sent = await submissions({
            attester: input.caller,
            garden: input.garden,
            chainId: input.chainId,
            sinceSeconds: sinceMs / 1000,
          });
          for (const { work: landed, transactionHash } of sent)
            transactionHashes.set(landed.id.toLowerCase(), transactionHash);
          return sent.map(({ work: landed }) => landed);
        },
      },
    });
    if (identity.status === "waiting")
      return absentOnceCovered(input.chainId, indexed, { sentAtMs, intentChainTime, idleBlock });
    // A failed metadata read or a duplicate identity proves nothing either way.
    if (identity.status !== "resolved") return { status: "unknown" };
    const transactionHash = transactionHashes.get(identity.workUID.toLowerCase());
    return transactionHash ? { status: "found", transactionHash } : { status: "unknown" };
  };

  const decision: StrandedDecisionLookup = async ({
    sinceMs,
    sentAtMs,
    intentChainTime,
    idleBlock,
    steward,
    ...input
  }) => {
    const indexed = await indexedBlock(input.chainId);
    const sent = await decisions({
      attester: steward,
      workUID: input.decision.workUID,
      chainId: input.chainId,
      sinceSeconds: sinceMs / 1000,
    });
    // The resolver accepts a repeated decision, so one this steward already made
    // with every field this send carries counts as this one: completing it beats
    // sending twice. One that differs in any field, such as its feedback or review
    // notes, is another decision, and never settles this send.
    const landed = sent.find(({ decision: made }) => sameDecision(made, input.decision));
    if (!landed)
      return absentOnceCovered(input.chainId, indexed, { sentAtMs, intentChainTime, idleBlock });
    return landed.transactionHash
      ? { status: "found", transactionHash: landed.transactionHash }
      : { status: "unknown" };
  };

  return { work, decision };
}
