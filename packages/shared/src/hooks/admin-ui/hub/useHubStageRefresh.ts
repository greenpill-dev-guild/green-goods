import { useCallback } from "react";
import { useRefreshAction } from "../../../components/Canvas/RefreshActionContext";
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
 * failed-read message.
 */
export function useHubStageRefresh({
  stage,
  reads,
  enabled,
  onRefreshed,
}: {
  stage: HubPipelineStage;
  reads: Record<HubPipelineStage, HubStageRead>;
  /** A garden is open, so there is a list to reread. */
  enabled: boolean;
  /** Called once the stage's reread settles. */
  onRefreshed: () => void;
}) {
  const { refresh, isFetching } = reads[stage];
  const handleRefresh = useCallback(() => {
    void Promise.resolve(refresh()).finally(onRefreshed);
  }, [onRefreshed, refresh]);
  useRefreshAction(enabled ? { onRefresh: handleRefresh, isFetching } : null);
  return handleRefresh;
}
