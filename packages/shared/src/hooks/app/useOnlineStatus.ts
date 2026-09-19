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

/** Rich status for connectivity banners; existing boolean consumers stay compatible. */
export function useConnectivityStatus() {
  return useSyncExternalStore(
    connectivityStore.subscribeStatus,
    connectivityStore.getStatusSnapshot,
    connectivityStore.getServerStatusSnapshot
  );
}

/** Installed app composition opts into the uncached same-origin probe. */
export const configureConnectivityProbe = connectivityStore.configureProbe;
export const reportConnectivityFailure = connectivityStore.reportNetworkFailure;
