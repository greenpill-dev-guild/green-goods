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
 * 12). `none` means silence: the queue has not answered, nothing waits, or an upload outside the
 * active garden cannot be placed until the member's gardens are known.
 */
export type ArrivalState = { kind: "none" } | { kind: "queue"; orientation: UploadOrientation };

const SILENT: ArrivalState = { kind: "none" };

export function useArrivalState(): ArrivalState {
  const account = usePrimaryAddress();
  const chainId = useCurrentChain();
  const { inScope, myGardens } = useActiveGarden(chainId);
  const queued = useLiveQuery(account?.toLowerCase() ?? null, () =>
    jobQueueDB.observeJobs({ userAddress: account ?? "", synced: false })
  );

  const { gardens, isLoaded } = myGardens;
  return useMemo<ArrivalState>(() => {
    if (!account || !queued.isSuccess) return SILENT;
    const uploads = (queued.data ?? [])
      .filter((job) => isUploadOnPhone(job, chainId))
      .sort((newer, older) => older.createdAt - newer.createdAt);
    if (uploads.length === 0) return SILENT;
    const orientation = orientUploads(
      inScope,
      isLoaded ? gardens.map(({ garden }) => garden) : null,
      uploads.map(uploadGarden)
    );
    return orientation ? { kind: "queue", orientation } : SILENT;
  }, [account, queued.isSuccess, queued.data, chainId, inScope, isLoaded, gardens]);
}
