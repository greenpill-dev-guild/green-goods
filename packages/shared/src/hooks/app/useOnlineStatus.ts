import { useSyncExternalStore } from "react";
import { connectivityStore } from "../../stores/connectivity";

/** Shares query connectivity without requiring auth or queue providers. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot
  );
}
