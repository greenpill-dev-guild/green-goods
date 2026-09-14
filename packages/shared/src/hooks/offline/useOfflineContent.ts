import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { gardensKeys } from "../../config/query-keys/garden";
import { getWorkApprovals, getWorks } from "../../modules/data/eas";
import {
  downloadMedia,
  isMediaCached,
  isMediaWorkerReady,
  monitorMediaWorker,
  readMediaStats,
  retireLegacyPreparedMedia,
  subscribeMediaWorker,
  sweepMedia,
} from "../../modules/offline-content/media";
import { OFFLINE_REFRESH_MS } from "../../modules/offline-content/policy";
import { persistPreparedQueries } from "../../modules/offline-content/query-writer";
import { OfflineScheduler } from "../../modules/offline-content/scheduler";
import {
  getOfflineProgress,
  reportOfflineStorageFailure,
  subscribeOfflineProgress,
  updateOfflineProgress,
} from "../../modules/offline-content/store";
import { readWorkMetadata } from "../../modules/work/read-work-metadata";
import { connectivityStore } from "../../stores/connectivity";
import type { Garden } from "../../types/domain";
import { useOnlineStatus } from "../app/useOnlineStatus";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useGardens } from "../blockchain/useBaseLists";
import { useResolvedProfileAvatar } from "../profile/useProfileAvatar";

/** The first run waits for the app to settle after launch. */
const STARTUP_DELAY_MS = 4_000;
const RECONNECT_DELAY_MS = 2_000;
const MEMBERSHIP_DELAY_MS = 5_000;
/** Opening a garden never starts downloads right away; its photos follow once the screen settles. */
const GARDEN_IN_VIEW_DELAY_MS = 8_000;

interface NetworkInformationLike extends EventTarget {
  saveData?: boolean;
  type?: string;
  effectiveType?: string;
}

let activeScheduler: OfflineScheduler | undefined;
let gardenInView: string | undefined;

function networkInformation(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function isCellular(connection?: NetworkInformationLike): boolean {
  return (
    connection?.type === "cellular" ||
    ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "")
  );
}

function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 2_000 });
    } else {
      setTimeout(resolve, 50);
    }
  });
}

function joinedGardens(gardens: Garden[] | undefined, account: string | null, chainId: number) {
  if (!gardens || !account) return "";
  const member = account.toLowerCase();
  return gardens
    .filter(
      (garden) =>
        garden.chainId === chainId &&
        [...garden.gardeners, ...garden.stewards, ...garden.owners].some(
          (address) => address.toLowerCase() === member
        )
    )
    .map((garden) => garden.id.toLowerCase())
    .sort()
    .join(",");
}

/**
 * Installed shell composition. Prepares offline content in the background after
 * the persisted reads are restored; nothing on screen starts or waits for it.
 */
export function useOfflineContentPreparation(chainId = DEFAULT_CHAIN_ID): void {
  const client = useQueryClient();
  const restoring = useIsRestoring();
  const account = usePrimaryAddress();
  const gardens = useGardens(chainId);
  const avatar = useResolvedProfileAvatar(account, "/images/avatar.png", chainId);
  const avatarUrl = useRef<string | undefined>(undefined);
  avatarUrl.current = avatar.avatarUri ?? undefined;

  useEffect(() => monitorMediaWorker(), []);

  useEffect(() => {
    if (restoring || !account) return;
    const connection = networkInformation();
    const scheduler = new OfflineScheduler({
      client,
      chainId,
      account: () => account,
      gardens: () => client.getQueryData<Garden[]>(gardensKeys.byChain(chainId)),
      avatarUrl: () => avatarUrl.current,
      online: () => connectivityStore.getSnapshot(),
      visible: () => document.visibilityState !== "hidden",
      dataSaver: () => Boolean(networkInformation()?.saveData),
      cellular: () => isCellular(networkInformation()),
      mediaReady: isMediaWorkerReady,
      fetchWorks: (garden) => getWorks(garden, chainId),
      fetchApprovals: () => getWorkApprovals(undefined, chainId),
      readMetadata: readWorkMetadata,
      media: {
        isCached: isMediaCached,
        download: downloadMedia,
        sweep: sweepMedia,
        retireLegacy: retireLegacyPreparedMedia,
      },
      persist: async () => {
        try {
          await persistPreparedQueries(client);
        } catch (error) {
          reportOfflineStorageFailure();
          throw error;
        }
      },
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      idle: waitForIdle,
      now: Date.now,
    });
    scheduler.setActiveGarden(gardenInView);
    activeScheduler = scheduler;

    const refreshStats = () =>
      void readMediaStats().then((stats) => {
        if (stats) updateOfflineProgress({ savedBytes: stats.bytes });
      });
    const onConnectivity = () => {
      scheduler.environmentChanged();
      const { state } = getOfflineProgress();
      const stale = Date.now() - scheduler.lastRun > OFFLINE_REFRESH_MS;
      if (
        connectivityStore.getSnapshot() &&
        (stale || state === "paused" || state === "incomplete")
      ) {
        scheduler.schedule(RECONNECT_DELAY_MS);
      }
    };
    const onVisibility = () => {
      scheduler.environmentChanged();
      if (
        document.visibilityState !== "hidden" &&
        Date.now() - scheduler.lastRun > OFFLINE_REFRESH_MS
      ) {
        scheduler.schedule(RECONNECT_DELAY_MS);
      }
    };
    const onWorker = () => {
      scheduler.environmentChanged();
      refreshStats();
    };
    const onNetwork = () => scheduler.environmentChanged();

    const unsubscribeConnectivity = connectivityStore.subscribe(onConnectivity);
    const unsubscribeWorker = subscribeMediaWorker(onWorker);
    document.addEventListener("visibilitychange", onVisibility);
    connection?.addEventListener?.("change", onNetwork);
    refreshStats();
    scheduler.schedule(STARTUP_DELAY_MS);

    return () => {
      scheduler.stop();
      if (activeScheduler === scheduler) activeScheduler = undefined;
      unsubscribeConnectivity();
      unsubscribeWorker();
      document.removeEventListener("visibilitychange", onVisibility);
      connection?.removeEventListener?.("change", onNetwork);
    };
  }, [client, account, chainId, restoring]);

  // Joining or leaving a garden changes what is kept offline.
  const membership = useMemo(
    () => joinedGardens(gardens.data, account, chainId),
    [gardens.data, account, chainId]
  );
  useEffect(() => {
    if (membership) activeScheduler?.schedule(MEMBERSHIP_DELAY_MS);
  }, [membership]);
}

/** Marks the garden on screen so its photos are kept too, once the screen settles. */
export function useActiveOfflineGarden(gardenId?: string): void {
  useEffect(() => {
    if (!gardenId) return;
    gardenInView = gardenId;
    activeScheduler?.setActiveGarden(gardenId);
    activeScheduler?.schedule(GARDEN_IN_VIEW_DELAY_MS);
    return () => {
      if (gardenInView !== gardenId) return;
      gardenInView = undefined;
      activeScheduler?.setActiveGarden(undefined);
    };
  }, [gardenId]);
}

/** Progress and controls for the Settings row. */
export function useOfflineStatus() {
  const progress = useSyncExternalStore(
    subscribeOfflineProgress,
    getOfflineProgress,
    getOfflineProgress
  );
  const online = useOnlineStatus();
  return {
    progress,
    online,
    pause: () => activeScheduler?.pause(),
    resume: () => activeScheduler?.resume(),
    refresh: () => activeScheduler?.schedule(0, { refresh: true }),
  };
}
