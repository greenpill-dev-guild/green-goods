import { useCallback } from "react";
import type { GardenJoinRequestKind } from "../../../public-contracts/join-requests";
import { useGardenStateStore } from "../../../stores/useGardenStateStore";
import { useJoinRequestCount, useJoinRequestCountUpdates } from "../../garden/useJoinRequestCount";

/**
 * How many join requests wait on a garden's stewards, for the Members tab's badge (DL-134). A badge
 * never asks for a signature, so this reads the service with the count grant the steward's last
 * signed check left in this browser (`useJoinRequestCount`), once on arrival and again as requests
 * are answered. Without a grant, or if that read fails before it has answered, it holds what each
 * queue's last check found; before any check it holds nothing. Those last checks live with the
 * garden's workspace state because the Community view remounts between some of its tabs; that
 * state lasts the browser tab's session and clears when a different account signs in.
 */
export function useJoinRequestsWaiting(gardenKey: string) {
  const { waiting: counted } = useJoinRequestCount(gardenKey);
  const { keepCountGrant, readCountAgain } = useJoinRequestCountUpdates(gardenKey);
  const lastChecks = useGardenStateStore(
    (state) => state.getGardenWorkspaceState(gardenKey, "community").joinRequestsWaiting
  );

  const noteJoinRequestsRead = useCallback(
    (kind: GardenJoinRequestKind, waiting: number) => {
      const store = useGardenStateStore.getState();
      const { joinRequestsWaiting } = store.getGardenWorkspaceState(gardenKey, "community");
      store.setGardenWorkspaceState(gardenKey, "community", {
        joinRequestsWaiting: { ...joinRequestsWaiting, [kind]: waiting },
      });
      readCountAgain();
    },
    [gardenKey, readCountAgain]
  );

  return {
    joinRequestsWaiting:
      counted ?? (lastChecks?.garden_membership ?? 0) + (lastChecks?.steward_access ?? 0),
    noteJoinRequestsRead,
    keepJoinRequestCountGrant: keepCountGrant,
  };
}
