/**
 * useYourWorkCount Hook
 *
 * How much of the reader's work is still on this phone (D1): work drafts, work
 * and decisions waiting to upload or being checked, and unsent proof, whether
 * queued or a draft with something in it. Home's Your Work badge, the bottom
 * bar's Home badge and Your Work's Pending tab show this count. Work already
 * sent and waiting for a review is listed in Pending but not counted: it is no
 * longer on the phone.
 *
 * It counts what the active garden's Your Work lists (DL-129), so a badge and
 * its sheet always agree: work queued for another of the member's gardens is
 * counted once the chip switches there.
 *
 * @module hooks/work/useYourWorkCount
 */

import { jobQueueDB } from "../../modules/job-queue/db";
import { isUploadOnPhone, uploadGarden } from "../../modules/work/your-work-on-phone";
import {
  commitmentProofDraftPrefix,
  proofDraftHasContent,
  useCommitmentProofDraftStore,
} from "../../stores/useCommitmentProofDraftStore";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useActiveGarden } from "../garden/useActiveGarden";
import { useLiveQuery } from "../utils/useLiveQuery";
import { useDrafts } from "./useDrafts";

export function useYourWorkCount(): { count: number } {
  const primaryAddress = usePrimaryAddress();
  const chainId = useCurrentChain();
  const { inScope } = useActiveGarden(chainId);
  const { drafts } = useDrafts();
  const queued = useLiveQuery(primaryAddress?.toLowerCase() ?? null, () =>
    jobQueueDB.observeJobs({ userAddress: primaryAddress ?? "", synced: false })
  );
  const proofDrafts = useCommitmentProofDraftStore((state) => {
    if (!primaryAddress) return 0;
    const prefix = commitmentProofDraftPrefix(chainId, primaryAddress);
    return Object.entries(state.drafts).filter(
      ([key, draft]) =>
        key.startsWith(prefix) && proofDraftHasContent(draft) && inScope([draft.garden])
    ).length;
  });
  const workDrafts = drafts.filter((draft) => inScope([draft.gardenAddress])).length;
  // Pending lists this chain's items, so the badge counts the same ones. Every
  // counted kind's payload names the garden it writes to.
  const jobs = (queued.data ?? []).filter(
    (job) => isUploadOnPhone(job, chainId) && inScope([uploadGarden(job)])
  ).length;
  return { count: workDrafts + jobs + proofDrafts };
}
