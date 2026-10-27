import { useMemo } from "react";
import { jobQueueDB } from "../../modules/job-queue/db";
import {
  isUploadOnPhone,
  orientUploads,
  type UploadOrientation,
  uploadGarden,
} from "../../modules/work/your-work-on-phone";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useActiveGarden } from "../garden/useActiveGarden";
import { useLiveQuery } from "../utils/useLiveQuery";

/**
 * The orientation the arrival toast gives a session that opens on Home: uploads still on this
 * phone, work, reviews or proof that are queued or failed, and where they are listed. Home's chip
 * and Continue show the member's garden and drafts, so the toast says nothing else (PWA Home step
 * 12). `pending` means it can't say yet: the queue has not answered, or an upload outside the
 * active garden can't be placed until the member's gardens are known. `none` means nothing waits,
 * so the arrival passes without a toast.
 */
export type ArrivalState =
  | { kind: "pending" }
  | { kind: "none" }
  | { kind: "queue"; orientation: UploadOrientation };

const PENDING: ArrivalState = { kind: "pending" };
const NOTHING_WAITS: ArrivalState = { kind: "none" };

export function useArrivalState(): ArrivalState {
  const account = usePrimaryAddress();
  const chainId = useCurrentChain();
  const { inScope, myGardens } = useActiveGarden(chainId);
  const queued = useLiveQuery(account?.toLowerCase() ?? null, () =>
    jobQueueDB.observeJobs({ userAddress: account ?? "", synced: false })
  );

  const { gardens, isLoaded } = myGardens;
  return useMemo<ArrivalState>(() => {
    if (!account || !queued.isSuccess) return PENDING;
    const uploads = (queued.data ?? [])
      .filter((job) => isUploadOnPhone(job, chainId))
      .sort((newer, older) => older.createdAt - newer.createdAt);
    if (uploads.length === 0) return NOTHING_WAITS;
    const orientation = orientUploads(
      inScope,
      isLoaded ? gardens.map(({ garden }) => garden) : null,
      uploads.map(uploadGarden)
    );
    return orientation ? { kind: "queue", orientation } : PENDING;
  }, [account, queued.isSuccess, queued.data, chainId, inScope, isLoaded, gardens]);
}
