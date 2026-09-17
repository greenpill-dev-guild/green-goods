import { useEffect, useState } from "react";
import { jobQueueDB } from "../../modules/job-queue/db";
import { jobQueueEventBus } from "../../modules/job-queue/event-bus";
import { connectivityStore } from "../../stores/connectivity";
import { isDataSaverOn, networkInformation } from "../../utils/app/network-information";
import { useAsyncSetup } from "../utils/useAsyncEffect";

/**
 * Prepares the signed-in person's queued work and decisions in the background,
 * so Upload all only has to sign. It wakes on the connectivity status channel,
 * which also reports each return to the page, when an item is queued, and when
 * Data Saver changes. Preparation and its modules load once the connection is
 * first confirmed: they may not be on this device yet, and an import that
 * fails offline stays failed for the life of the page.
 */
export function useWorkUploadPreparation(userAddress: string | null | undefined, chainId: number) {
  const [connected, setConnected] = useState(() => connectivityStore.isConfirmedOnline());
  useEffect(() => {
    if (connected) return;
    const check = () => {
      if (connectivityStore.isConfirmedOnline()) setConnected(true);
    };
    check();
    return connectivityStore.subscribeStatus(check);
  }, [connected]);

  useAsyncSetup(
    async (signal) => {
      if (!userAddress || !connected || typeof window === "undefined") return;
      const [preparationModule, { prepareQueuedJob }, { recoverStuckWork }, claims] =
        await Promise.all([
          import("../../modules/work/upload-preparation"),
          import("../../modules/work/prepare-queued-work"),
          import("../../modules/job-queue/stuck-work-recovery"),
          import("../../modules/job-queue/work-claims"),
        ]);
      if (signal.aborted) return;

      const preparation = preparationModule.createUploadPreparation({
        userAddress,
        chainId,
        isConfirmedOnline: () => connectivityStore.isConfirmedOnline(),
        isVisible: () => document.visibilityState !== "hidden",
        isDataSaverOn,
        listJobs: () => jobQueueDB.getJobs({ userAddress, synced: false }),
        getJob: (id) => jobQueueDB.getJob(id),
        acquire: claims.acquireAvailableWorkJobs,
        hold: claims.holdWorkClaims,
        prepare: (job, jobChainId, claim) => prepareQueuedJob(job, jobChainId, claim),
        recover: recoverStuckWork,
        now: () => Date.now(),
      });
      preparationModule.setActiveUploadPreparation(preparation);

      const schedule = () => preparation.schedule();
      const connection = networkInformation();
      const unsubscribeStatus = connectivityStore.subscribeStatus(schedule);
      const unsubscribeQueued = jobQueueEventBus.on("job:added", schedule);
      connection?.addEventListener("change", schedule);
      schedule();

      return () => {
        unsubscribeStatus();
        unsubscribeQueued();
        connection?.removeEventListener("change", schedule);
        preparation.stop();
        preparationModule.setActiveUploadPreparation(undefined);
      };
    },
    [userAddress, chainId, connected]
  );
}
