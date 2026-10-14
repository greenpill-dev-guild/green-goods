/**
 * useYourWorkCount Hook
 *
 * How much of the reader's work is still on this phone (D1): work drafts, work
 * and decisions waiting to upload or being checked, and unsent proof, whether
 * queued or a draft with something in it. Home's Your Work badge and its Pending
 * tab show this count. Work already sent and waiting for a review is listed in
 * Pending but not counted: it is no longer on the phone.
 *
 * @module hooks/work/useYourWorkCount
 */

import { jobQueueDB } from "../../modules/job-queue/db";
import {
  commitmentProofDraftPrefix,
  proofDraftHasContent,
  useCommitmentProofDraftStore,
} from "../../stores/useCommitmentProofDraftStore";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useLiveQuery } from "../utils/useLiveQuery";
import { useDrafts } from "./useDrafts";

/** The queued kinds that are work on this phone; other promise acts are not. */
const ON_PHONE_KINDS = new Set(["work", "approval", "evidence"]);

export function useYourWorkCount(): { count: number } {
  const primaryAddress = usePrimaryAddress();
  const chainId = useCurrentChain();
  const { draftCount } = useDrafts();
  const queued = useLiveQuery(primaryAddress?.toLowerCase() ?? null, () =>
    jobQueueDB.observeJobs({ userAddress: primaryAddress ?? "", synced: false })
  );
  const proofDrafts = useCommitmentProofDraftStore((state) => {
    if (!primaryAddress) return 0;
    const prefix = commitmentProofDraftPrefix(chainId, primaryAddress);
    return Object.entries(state.drafts).filter(
      ([key, draft]) => key.startsWith(prefix) && proofDraftHasContent(draft)
    ).length;
  });
  // Pending lists this chain's items, so the badge counts the same ones.
  const jobs = (queued.data ?? []).filter(
    (job) => ON_PHONE_KINDS.has(job.kind) && (job.chainId ?? chainId) === chainId
  ).length;
  return { count: draftCount + jobs + proofDrafts };
}
