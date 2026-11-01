import { useCallback } from "react";
import type { GardenJoinRequestKind } from "../../../public-contracts/join-requests";
import { useGardenStateStore } from "../../../stores/useGardenStateStore";

/**
 * How many join requests wait on a garden's stewards, for the Members tab's badge (DL-134). The
 * queue reads only through the steward's signature and a badge never asks for one, so this holds
 * what each queue's last check found, and nothing before a check. It lives with the garden's
 * workspace state because the Community view remounts between some of its tabs; that state lasts
 * the browser tab's session and clears when a different account signs in.
 */
export function useJoinRequestsWaiting(gardenKey: string) {
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
    },
    [gardenKey]
  );

  return {
    joinRequestsWaiting: (lastChecks?.garden_membership ?? 0) + (lastChecks?.steward_access ?? 0),
    noteJoinRequestsRead,
  };
}
