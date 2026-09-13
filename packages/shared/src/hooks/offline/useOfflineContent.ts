import {
  getOfflineWorkerSupport,
  subscribeOfflineWorker,
  monitorOfflineWorker,
} from "../../modules/offline-content/worker";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useIsRestoring, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { actionsKeys, gardensKeys } from "../../config/query-keys/garden";
import { ensKeys, profileAvatarKeys, gardenerProfileKeys } from "../../config/query-keys/identity";
import { worksKeys } from "../../config/query-keys/work";
import { getRecentWorks, getPreparedWorkApprovals } from "../../modules/data/eas";
import { resolveIPFSUrl } from "../../modules/data/ipfs/resolve";
import { OfflineDownloadCoordinator } from "../../modules/offline-content/coordinator";
import {
  displayImageUrl,
  OFFLINE_READING_BUDGET,
  selectPreparationTargets,
} from "../../modules/offline-content/policy";
import {
  configureOfflineQueryFlush,
  getOfflineContentSnapshot,
  readingBytes,
  restoreDownloadManifest,
  subscribeOfflineContent,
  updateDownloadManifest,
  verifyPreparedContent,
} from "../../modules/offline-content/store";
import { gardenPreparationKey } from "../../modules/offline-content/types";
import { connectivityStore } from "../../stores/connectivity";
import { readWorkMetadata } from "../../modules/work/read-work-metadata";
import type { Action, Garden, WorkMetadata } from "../../types/domain";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useGardenerProfile } from "../gardener/useGardenerProfile";
import { useEnsName } from "../blockchain/useEnsName";
import { useAuth } from "../auth/useAuth";
import { useActions, useGardens } from "../blockchain/useBaseLists";
import { useResolvedProfileAvatar } from "../profile/useProfileAvatar";

let retry: (() => void) | undefined;
let activeGarden: string | undefined;
export { useOfflineAssetAvailability } from "./useOfflineAssetAvailability";
export { reportOfflineStorageFailure } from "../../modules/offline-content/store";
export { configureOfflineQueryPersistence } from "../../modules/offline-content/query-writer";
import { persistPreparedQueries } from "../../modules/offline-content/query-writer";

function useWorkerSupport() {
  return useSyncExternalStore(subscribeOfflineWorker, getOfflineWorkerSupport, () => false);
}
function useManifest() {
  return useSyncExternalStore(
    subscribeOfflineContent,
    getOfflineContentSnapshot,
    getOfflineContentSnapshot
  );
}

export function useGardenOfflineContent(address: string, chainId = DEFAULT_CHAIN_ID) {
  const manifest = useManifest();
  const workerReady = useWorkerSupport();
  const account = usePrimaryAddress();
  useEffect(() => {
    if (!address || !account) return;
    activeGarden = address;
    void restoreDownloadManifest()
      .then(() =>
        updateDownloadManifest((current) => ({
          ...current,
          visits: [
            { address, chainId, visitedAt: Date.now() },
            ...current.visits.filter(
              (visit) =>
                !(
                  visit.address.toLowerCase() === address.toLowerCase() && visit.chainId === chainId
                )
            ),
          ].slice(0, 50),
        }))
      )
      .then(() => retry?.())
      .catch(() => {});
    return () => {
      if (activeGarden === address) activeGarden = undefined;
    };
  }, [address, chainId, account]);
  const garden = account
    ? manifest.gardens[gardenPreparationKey(address, chainId, account)]
    : undefined;
  return {
    state: garden?.state === "ready" && !workerReady ? "partial" : (garden?.state ?? "unavailable"),
    updatedAt: garden?.updatedAt,
    workCount: garden?.workIds.length ?? 0,
    expectedWorkCount: garden?.requestedLimit,
    truncated: garden?.truncated ?? false,
    failures: garden?.failures ?? 0,
  };
}

export function useOfflinePreparationStatus() {
  const manifest = useManifest();
  const workerReady = useWorkerSupport();
  const account = usePrimaryAddress();
  const gardens = Object.values(manifest.gardens).filter(
    (garden) => garden.account === account?.toLowerCase()
  );
  const busy = gardens.some((garden) => garden.state === "preparing");
  const partial =
    !workerReady ||
    manifest.storageFailure ||
    !manifest.essentialReady ||
    gardens.some((garden) => garden.state !== "ready");
  return {
    bytes: readingBytes(manifest),
    budget: OFFLINE_READING_BUDGET,
    busy,
    partial,
    preparedGardens: gardens.filter((garden) => garden.state === "ready").length,
    totalGardens: gardens.length,
    updatedAt: manifest.essentialUpdatedAt,
    retry: () => retry?.(),
  };
}

/** Installed shell composition; restoration precedes all preparation and verification. */
export function useOfflineContentPreparation(chainId = DEFAULT_CHAIN_ID): void {
  const client = useQueryClient();
  const workerReady = useWorkerSupport();
  useEffect(() => monitorOfflineWorker(), []);
  const restoring = useIsRestoring();
  const account = usePrimaryAddress();
  const gardens = useGardens(chainId);
  const actions = useActions(chainId);
  const avatar = useResolvedProfileAvatar(account, "/images/avatar.png", chainId);
  const profile = useGardenerProfile();
  const { smartAccountAddress } = useAuth();
  const name = useEnsName(account);
  const data = useRef({
    gardens,
    actions,
    avatar,
    account,
    profile,
    name,
    smartAccountAddress,
    chainId,
  });
  data.current = { gardens, actions, avatar, account, profile, name, smartAccountAddress, chainId };
  const coordinator = useMemo(
    () =>
      new OfflineDownloadCoordinator({
        client,
        persistQueries: async () => {
          await persistPreparedQueries(client);
        },
        canRun: () =>
          workerReady &&
          getOfflineWorkerSupport() &&
          data.current.chainId === chainId &&
          data.current.account === account &&
          connectivityStore.getSnapshot() &&
          document.visibilityState !== "hidden",
        getWorks: getRecentWorks,
        workKey: worksKeys.preparedRecent,
        gardenPhotos: (address) => {
          const garden = data.current.gardens.data?.find(
            (item) => item.id.toLowerCase() === address.toLowerCase()
          );
          return garden?.bannerImage ? [displayImageUrl(resolveIPFSUrl(garden.bannerImage))] : [];
        },
        getApprovals: async (works, chain, gardenAddress) => {
          const known =
            client.getQueryData<Awaited<ReturnType<typeof getPreparedWorkApprovals>>["approvals"]>(
              worksKeys.preparedApprovals(gardenAddress, chain)
            ) ?? [];
          const prepared = await getPreparedWorkApprovals(
            works.map((work) => work.id),
            chain
          );
          if (prepared.truncated) throw new Error("Approval preparation is incomplete");
          const fresh = prepared.approvals;
          const ids = new Set(works.map((work) => work.id.toLowerCase()));
          return {
            key: worksKeys.preparedApprovals(gardenAddress, chain),
            data: [
              ...known.filter((approval) => !ids.has(approval.workUID.toLowerCase())),
              ...fresh,
            ],
          };
        },
        getDetails: async (work, signal) => {
          const reads = [];
          let metadata: WorkMetadata | undefined;
          if (work.metadata) {
            const key = worksKeys.metadata(work.metadata);
            metadata = client.getQueryData<WorkMetadata>(key);
            if (!metadata) metadata = await readWorkMetadata(work.metadata, signal);
            reads.push({ key, data: metadata });
          }
          // Modern attachment MIME types distinguish photographs from video. Legacy
          // media with no attachment descriptors was the photo-only submission schema.
          const references = metadata?.attachments
            ? metadata.attachments
                .filter((attachment) => attachment.type.startsWith("image/"))
                .map((attachment) => attachment.cid)
            : work.media;
          return { reads, photos: references.map((ref) => displayImageUrl(resolveIPFSUrl(ref))) };
        },
        fetchMedia: (url, signal) => fetch(url, { signal, cache: "reload", credentials: "omit" }),
      }),
    [client, account, chainId, workerReady]
  );
  useEffect(() => {
    if (restoring || !account) return;
    configureOfflineQueryFlush(async () => {
      await persistPreparedQueries(client);
    });
    let disposed = false;
    let running = false;
    let requested = false;
    const run = async () => {
      if (
        disposed ||
        !getOfflineWorkerSupport() ||
        !connectivityStore.getSnapshot() ||
        document.visibilityState === "hidden"
      )
        return;
      if (running) {
        requested = true;
        return;
      }
      running = true;
      try {
        const current = data.current;
        const savedGardens = client.getQueryData<Garden[]>(gardensKeys.byChain(chainId));
        const savedActions = client.getQueryData<Action[]>(actionsKeys.byChain(chainId));
        if (!savedGardens || !savedActions || current.avatar.isLoading) return;
        const reads: Array<{ key: QueryKey; data: unknown }> = [
          { key: gardensKeys.byChain(chainId), data: savedGardens },
          { key: actionsKeys.byChain(chainId), data: savedActions },
        ];
        for (const key of [
          profileAvatarKeys.record(chainId, account),
          ensKeys.avatar(account),
          ensKeys.name(account.toLowerCase()),
          gardenerProfileKeys.byAddress(account, chainId),
        ]) {
          const value = client.getQueryData(key);
          if (value !== undefined) reads.push({ key, data: value });
        }
        const photos = [
          ...new Set([
            new URL("/images/avatar.png", location.origin).href,
            new URL(current.avatar.avatarUri ?? "/images/avatar.png", location.origin).href,
          ]),
        ];
        const actionPhotos = savedActions
          .flatMap((action) => action.media.slice(0, 1))
          .filter(Boolean)
          .map((ref) => displayImageUrl(resolveIPFSUrl(ref)));
        await coordinator.prepareEssentials(
          `${chainId}:${account.toLowerCase()}`,
          reads,
          photos,
          [...new Set(actionPhotos)],
          client.getQueryData(profileAvatarKeys.record(chainId, account)) !== undefined &&
            current.name.data !== undefined &&
            (!current.smartAccountAddress || current.profile.profile !== undefined)
        );
        const targets = selectPreparationTargets(
          savedGardens,
          account,
          chainId,
          getOfflineContentSnapshot().visits,
          activeGarden
        );
        await coordinator.prepare(account, targets);
      } catch {
        /* The manifest carries partial writes; local work remains usable. */
      } finally {
        running = false;
        if (requested && !disposed) {
          requested = false;
          void run();
        }
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden" || !connectivityStore.getSnapshot())
        coordinator.pause();
      else void run();
    };
    retry = () => {
      void run();
    };
    const unsubscribe = connectivityStore.subscribe(visibility);
    document.addEventListener("visibilitychange", visibility);
    void verifyPreparedContent(client).then(() => run());
    return () => {
      disposed = true;
      coordinator.pause();
      retry = undefined;
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [client, coordinator, account, chainId, restoring]);
  useEffect(() => {
    retry?.();
  }, [
    gardens.dataUpdatedAt,
    actions.dataUpdatedAt,
    avatar.avatarUri,
    avatar.isLoading,
    profile.profile,
    name.data,
  ]);
}
