import { useCallback } from "react";
import { useRefreshAction } from "../../../components/Canvas/RefreshActionContext";
import { useMediaQuery } from "../../ui/useMediaQuery";
import type { HubPipelineStage } from "./hub.utils";

/** What a refresh of one Hub stage rereads, and whether that read is running. */
export interface HubStageRead {
  refresh: () => unknown;
  isFetching: boolean;
}

/**
 * The Hub's refresh in the AppBar, which shows it below the desktop width. It
 * rereads the list the open stage shows, and its busy state follows that read:
 * each stage reads its own list, so a work refresh never stands in for a
 * failed hypercert read, and a reread that succeeds clears that stage's
 * failed-read message. A failed read every stage shows, such as the garden
 * list's, is reread with each.
 */
export function useHubStageRefresh({
  stage,
  reads,
  failedShared,
  enabled,
  onRefreshed,
}: {
  stage: HubPipelineStage;
  reads: Record<HubPipelineStage, HubStageRead>;
  /** A failed read behind every stage's message, reread with the open stage's. */
  failedShared?: HubStageRead;
  /** A garden is open, so there is a list to reread. */
  enabled: boolean;
  /**
   * Called once the rereads settle. A read that does not report when it
   * settles, as the work list's does not, counts as settled at once.
   */
  onRefreshed: () => void;
}) {
  // The AppBar draws the refresh only below this width, so the Hub registers
  // none above it, where a registration would only re-render it on each read.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { refresh, isFetching } = reads[stage];
  const sharedRefresh = failedShared?.refresh;
  const handleRefresh = useCallback(() => {
    // Each read reports its own failure in its own state, so the refresh only
    // waits for them to settle.
    void Promise.allSettled([refresh(), sharedRefresh?.()]).then(onRefreshed);
  }, [onRefreshed, refresh, sharedRefresh]);
  useRefreshAction(
    enabled && !isDesktop
      ? { onRefresh: handleRefresh, isFetching: isFetching || Boolean(failedShared?.isFetching) }
      : null
  );
  return handleRefresh;
}
