/**
 * usePendingProof Hook
 *
 * Proof still on this phone, for Your Work (D13): proof the queue holds to send,
 * failed ones included, and proof drafts with something in them. Each is named
 * by its promise and opens there. They live on the phone already: queued proof
 * as an evidence job in the same queue as work, drafts in the proof draft store.
 *
 * @module hooks/client-ui/commitment/usePendingProof
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { STALE_TIME_MEDIUM } from "../../../config/query-keys/constants";
import { getCommitmentDetail } from "../../../modules/commitment-pooling/data";
import type { EvidenceJobPayload } from "../../../modules/commitment-pooling/job-types";
import { proofDraftRepository } from "../../../modules/commitment-pooling/proof-draft-repository";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import { isHeicFile, isVideoFile } from "../../../modules/work/media-processing";
import {
  commitmentProofDraftPrefix,
  proofDraftHasContent,
  useCommitmentProofDraftStore,
} from "../../../stores/useCommitmentProofDraftStore";
import type { Address } from "../../../types/domain";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitmentPools } from "../../commitment-pooling/useCommitmentPooling";
import { useCommitmentPoolingAvailability } from "../../commitment-pooling/useCommitmentPoolingAvailability";
import { useCommitmentQueueState } from "../../commitment-pooling/useCommitmentQueueState";
import { type ProofContents, proofContentsOf } from "./proofContents";
import { proofSendKey, useProofSends } from "./proofSend";

export interface PendingProof {
  /** The job's id for proof in the queue; the draft's key for a draft. */
  id: string;
  source: "queued" | "draft";
  commitmentId: bigint;
  /** The garden whose pool holds the promise, where its page opens; null until known. */
  garden: Address | null;
  /** The promise as read, for its title; null until its record is read. */
  commitment: CommitmentReadModel | null;
  /** The promise's own title, from its metadata. */
  title: string | null;
  /** When it was queued, or when the draft last changed, in milliseconds. */
  savedAt: number;
  contents: ProofContents;
  /** Queued proof: why it waits, as the promise's notice would say. */
  waitingReason: string | null;
  /** Queued proof that stopped after its tries. */
  failed: boolean;
  /** This phone is sending it right now. */
  sending: boolean;
  /** Whether throwing it away is safe: never while a send may be on its way. */
  discardable: boolean;
  /** Queued proof's first photo, for its row; a draft's files stay unread. */
  firstPhoto: File | null;
}

/** A draft key, `proof:<chain>:<viewer>:<commitment>`, back to its commitment id. */
function commitmentIdOfDraftKey(key: string, prefix: string): bigint | null {
  try {
    return BigInt(key.slice(prefix.length));
  } catch {
    return null;
  }
}

export function usePendingProof(input: { chainId: number; viewer: Address | null }): {
  items: PendingProof[];
  /** The queue could not be read, so queued proof may be missing from `items`. */
  isUnavailable: boolean;
} {
  const { chainId, viewer } = input;
  const queue = useCommitmentQueueState(viewer);
  const drafts = useCommitmentProofDraftStore((state) => state.drafts);
  const availability = useCommitmentPoolingAvailability({ chainId });

  const proofSends = useProofSends();

  const found = useMemo(() => {
    const isSending = (commitmentId: bigint) => {
      const send = viewer
        ? proofSends.get(proofSendKey(chainId, BigInt(commitmentId), viewer))
        : null;
      return Boolean(send && !send.landed);
    };
    const items: Omit<PendingProof, "garden" | "commitment" | "title">[] = [];
    const gardens = new Map<string, Address>();
    for (const job of queue.proofJobs) {
      if ((job.chainId ?? chainId) !== chainId) continue;
      const payload = job.payload as EvidenceJobPayload;
      const key = String(payload.commitmentId);
      const failed = queue.failedJobs.get(key);
      const waiting = queue.pendingActs.get(key);
      const own = failed?.jobId === job.id ? failed : waiting?.jobId === job.id ? waiting : null;
      if (payload.gardenAddress) gardens.set(key, payload.gardenAddress as Address);
      items.push({
        id: job.id,
        source: "queued",
        commitmentId: BigInt(payload.commitmentId),
        savedAt: job.createdAt,
        contents: proofContentsOf(payload),
        waitingReason: waiting?.jobId === job.id ? waiting.waitingReason : null,
        failed: failed?.jobId === job.id,
        sending: isSending(payload.commitmentId),
        discardable: !isSending(payload.commitmentId) && (own?.discardable ?? false),
        firstPhoto: payload.media?.find((file) => !isVideoFile(file) && !isHeicFile(file)) ?? null,
      });
    }
    const prefix = viewer ? commitmentProofDraftPrefix(chainId, viewer) : null;
    for (const [key, draft] of Object.entries(drafts)) {
      if (!prefix || !key.startsWith(prefix)) continue;
      const commitmentId = commitmentIdOfDraftKey(key, prefix);
      if (commitmentId === null) continue;
      if (!proofDraftHasContent(draft)) continue;
      const contents: ProofContents = {
        ...(draft.files ?? { photos: 0, videos: 0, voiceNotes: 0 }),
        links: draft.links.length,
        words: draft.note.trim().length > 0,
      };
      // Saved with the draft, so it reopens without the promise's record.
      const promise = commitmentId.toString();
      if (draft.garden && !gardens.has(promise)) gardens.set(promise, draft.garden as Address);
      items.push({
        id: key,
        source: "draft",
        commitmentId,
        savedAt: draft.updatedAt,
        contents,
        waitingReason: null,
        failed: false,
        sending: false,
        discardable: true,
        firstPhoto: null,
      });
    }
    return { items, gardens };
  }, [chainId, drafts, proofSends, queue.failedJobs, queue.pendingActs, queue.proofJobs, viewer]);

  // Each promise's own record names it and says where it opens. The key is the
  // promise page's, so both read one copy.
  const ids = useMemo(
    () => [...new Set(found.items.map((item) => item.commitmentId.toString()))],
    [found.items]
  );
  const details = useQueries({
    queries: ids.map((id) => ({
      queryKey: commitmentPoolingKeys.commitment(chainId, BigInt(id)),
      queryFn: () => getCommitmentDetail(chainId, BigInt(id)),
      enabled: availability.status === "available",
      staleTime: STALE_TIME_MEDIUM,
    })),
  });
  const byId = new Map<string, CommitmentReadModel>();
  for (const [index, id] of ids.entries()) {
    const commitment = details[index]?.data?.commitment;
    if (commitment) byId.set(id, commitment);
  }
  const commitments = [...byId.values()];
  const metadata = useCommitmentMetadata(commitments);
  // A promise's page opens under its pool's garden. Queued proof names the
  // garden it was added from, and a draft the one it was opened under; an
  // older draft without one finds it through the promise's pool.
  const { pools } = useCommitmentPools({ chainId });

  const items = found.items
    .map((item) => {
      const key = item.commitmentId.toString();
      const commitment = byId.get(key) ?? null;
      const cid = commitment?.metadataCID?.trim();
      const pool = commitment?.poolId
        ? pools.find((candidate) => candidate.poolId === commitment.poolId)
        : undefined;
      return {
        ...item,
        commitment,
        title: (cid && metadata.byCID.get(cid)?.title) || null,
        garden: found.gardens.get(key) ?? (pool?.garden as Address | undefined) ?? null,
      };
    })
    .sort((left, right) => right.savedAt - left.savedAt);

  return { items, isUnavailable: queue.isUnavailable };
}

/**
 * Throws one pending proof away from Your Work. Queued proof goes through the
 * queue, which refuses a proof that may already be on its way; a draft goes
 * with its saved files. Resolves whether it was removed.
 */
export async function discardPendingProof(
  item: Pick<PendingProof, "id" | "source">
): Promise<boolean> {
  if (item.source === "queued") return jobQueue.discardJob(item.id);
  useCommitmentProofDraftStore.getState().clearDraft(item.id);
  await proofDraftRepository.clear(item.id);
  return true;
}
