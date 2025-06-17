import { encodeFunctionData } from "viem";
import { arbitrum } from "viem/chains";
import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import { EAS } from "@/constants";
import { abi } from "@/utils/abis/EAS.json";
import { encodeWorkData, encodeWorkApprovalData } from "@/utils/eas";
import { offlineDB } from "./offline-db";
import { queryClient } from "./react-query";

// Using any types for dynamic data from offline storage - keeping as comments for reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// type OfflineWorkData = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// type SmartAccountClient = any;

export class OfflineSync {
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;

  // Start periodic sync
  startSync(intervalMs = 30000) {
    // Initial sync
    this.sync();

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.sync();
    }, intervalMs);

    // Sync when coming back online
    window.addEventListener("online", () => {
      this.sync();
    });
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async sync() {
    // Prevent concurrent syncs
    if (this.syncInProgress || !navigator.onLine) {
      return;
    }

    this.syncInProgress = true;

    try {
      const unsyncedWork = await offlineDB.getUnsyncedWork();

      for (const work of unsyncedWork) {
        try {
          if (work.type === "work") {
            await this.syncWork(work);
          } else if (work.type === "approval") {
            await this.syncApproval(work);
          }

          await offlineDB.markAsSynced(work.id);
        } catch (error) {
          await offlineDB.markAsError(
            work.id,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }

      // Clean up synced work
      await offlineDB.clearSyncedWork();

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
    } finally {
      this.syncInProgress = false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncWork(work: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const smartAccountClient = (window as any).smartAccountClient;
    if (!smartAccountClient) {
      throw new Error("Smart account client not available");
    }

    // Get images from offline storage
    const images = await offlineDB.getImagesForWork(work.id);
    const imageFiles = images.map((img) => img.file);

    // Encode work data with images
    const encodedAttestationData = await encodeWorkData({
      ...work.data,
      media: imageFiles,
    });

    const encodedData = encodeFunctionData({
      abi,
      functionName: "attest",
      args: [
        {
          schema: EAS["42161"].WORK.uid,
          data: {
            recipient: work.data.gardenAddress as `0x${string}`,
            expirationTime: NO_EXPIRATION,
            revocable: true,
            refUID: ZERO_BYTES32,
            data: encodedAttestationData,
            value: 0n,
          },
        },
      ],
    });

    const receipt = await smartAccountClient.sendTransaction({
      chain: arbitrum,
      to: EAS["42161"].EAS.address as `0x${string}`,
      value: 0n,
      data: encodedData,
    });

    return receipt;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncApproval(work: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const smartAccountClient = (window as any).smartAccountClient;
    if (!smartAccountClient) {
      throw new Error("Smart account client not available");
    }

    const encodedAttestationData = encodeWorkApprovalData(work.data);

    const encodedData = encodeFunctionData({
      abi,
      functionName: "attest",
      args: [
        {
          schema: EAS["42161"].WORK_APPROVAL.uid,
          data: {
            recipient: work.data.gardenerAddress as `0x${string}`,
            expirationTime: NO_EXPIRATION,
            revocable: true,
            refUID: ZERO_BYTES32,
            data: encodedAttestationData,
            value: 0n,
          },
        },
      ],
    });

    const receipt = await smartAccountClient.sendTransaction({
      chain: arbitrum,
      to: EAS["42161"].EAS.address as `0x${string}`,
      value: 0n,
      data: encodedData,
    });

    return receipt;
  }

  // Check if there are pending offline items
  async hasPendingWork(): Promise<boolean> {
    const unsyncedWork = await offlineDB.getUnsyncedWork();
    return unsyncedWork.length > 0;
  }

  // Get count of pending items
  async getPendingCount(): Promise<number> {
    const unsyncedWork = await offlineDB.getUnsyncedWork();
    return unsyncedWork.length;
  }
}

export const offlineSync = new OfflineSync();
