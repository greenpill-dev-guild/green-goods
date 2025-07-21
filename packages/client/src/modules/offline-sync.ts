/**
 * @fileoverview Offline Synchronization System for Green Goods Application
 *
 * This module handles synchronization of offline work submissions and approvals
 * to the blockchain when network connectivity is restored. Key features include:
 *
 * - Automatic sync when coming back online
 * - Periodic sync attempts for pending items
 * - Work submission sync with media uploads
 * - Work approval sync with attestation data
 * - Error handling and retry logic
 * - Smart account client integration
 *
 * The OfflineSync class ensures data integrity and seamless user experience
 * by automatically syncing pending offline operations to the Ethereum blockchain
 * via EAS (Ethereum Attestation Service) when connectivity allows.
 *
 * @author Green Goods Team
 * @version 1.0.0
 */

import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
// Removed unused import - keeping type info in comments for future use
// import { type SmartWalletClientType } from "@privy-io/react-auth/smart-wallets";
import { encodeFunctionData } from "viem";
import { arbitrum } from "viem/chains";
import { getEASConfig } from "@/config";
import { abi } from "@/utils/abis/EAS.json";
import { encodeWorkApprovalData, encodeWorkData } from "@/utils/eas";
import { offlineDB } from "./offline-db";
import { queryClient } from "./react-query";

// Using any types for dynamic data from offline storage - keeping as comments for reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// type OfflineWorkData = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// type SmartAccountClient = any;

/**
 * Manages synchronization of offline work submissions and approvals to the blockchain.
 *
 * This class handles the complex process of syncing offline data to the Ethereum
 * blockchain using EAS attestations. It supports both work submissions and approvals,
 * handling media uploads, transaction encoding, and error recovery.
 *
 * Key responsibilities:
 * - Monitor network connectivity
 * - Sync pending offline work items
 * - Handle blockchain transaction submission
 * - Manage sync state and error handling
 * - Coordinate with IndexedDB for offline storage
 *
 * @example
 * ```typescript
 * import { offlineSync } from './offline-sync';
 *
 * // Set smart account client when user authenticates
 * offlineSync.setSmartAccountClient(smartAccountClient);
 *
 * // Start periodic sync (30 seconds interval)
 * offlineSync.startSync(30000);
 *
 * // Check for pending work
 * const hasPending = await offlineSync.hasPendingWork();
 * if (hasPending) {
 *   console.log(`${await offlineSync.getPendingCount()} items pending sync`);
 * }
 * ```
 */
export class OfflineSync {
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private smartAccountClient: any = null;

  /**
   * Sets the smart account client for blockchain transactions
   *
   * This method should be called when the user successfully authenticates
   * and a smart account client becomes available. The client is required
   * for submitting transactions to the blockchain.
   *
   * @param client - The smart account client from Privy/Pimlico
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSmartAccountClient(client: any) {
    this.smartAccountClient = client;
  }

  /**
   * Retrieves the smart account client with proper error handling
   *
   * @returns The smart account client instance
   * @throws Error if no smart account client is available
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getSmartAccountClient(): any {
    if (!this.smartAccountClient) {
      throw new Error("Smart account client not available. Ensure user is authenticated.");
    }
    return this.smartAccountClient;
  }

  /**
   * Starts the periodic synchronization process
   *
   * This method:
   * - Performs an initial sync attempt
   * - Sets up periodic sync at the specified interval
   * - Registers event listener for network connectivity changes
   *
   * @param intervalMs - Sync interval in milliseconds (default: 30000ms = 30s)
   */
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

  /**
   * Stops the periodic synchronization process
   *
   * Cleans up the sync interval and stops automatic sync attempts.
   * Manual sync can still be triggered via the sync() method.
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Performs a synchronization cycle for all pending offline work
   *
   * This is the core sync method that:
   * - Prevents concurrent sync operations
   * - Retrieves unsynced work from offline storage
   * - Processes each item based on its type (work/approval)
   * - Handles errors and marks items as synced or failed
   * - Cleans up successfully synced items
   * - Invalidates React Query cache to refresh UI
   *
   * The method is idempotent and safe to call multiple times.
   * It will skip execution if already running or if offline.
   */
  async sync() {
    // Prevent concurrent syncs
    if (this.syncInProgress || !navigator.onLine) {
      return;
    }

    // Early return if no smart account client available
    if (!this.smartAccountClient) {
      // Skip sync when smart account client not available
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

  /**
   * Synchronizes a work submission to the blockchain
   *
   * This method handles the complete process of submitting work:
   * - Retrieves associated images from offline storage
   * - Encodes work data including media files
   * - Creates EAS attestation transaction
   * - Submits transaction via smart account client
   *
   * @param work - The offline work item to sync
   * @returns Promise resolving to the transaction receipt
   * @throws Error if smart account client unavailable or transaction fails
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncWork(work: any) {
    const smartAccountClient = this.getSmartAccountClient();

    // Get images from offline storage
    const images = await offlineDB.getImagesForWork(work.id);
    const imageFiles = images.map((img) => img.file);

    // Encode work data with images
    const encodedAttestationData = await encodeWorkData({
      ...work.data,
      media: imageFiles,
    });

    const easConfig = getEASConfig("42161");

    const encodedData = encodeFunctionData({
      abi,
      functionName: "attest",
      args: [
        {
          schema: easConfig.WORK.uid,
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
      to: easConfig.EAS.address as `0x${string}`,
      value: 0n,
      data: encodedData,
    });

    return receipt;
  }

  /**
   * Synchronizes a work approval to the blockchain
   *
   * This method handles the approval submission process:
   * - Encodes work approval data for EAS attestation
   * - Creates EAS attestation transaction for approval
   * - Submits transaction via smart account client
   *
   * @param work - The offline work approval item to sync
   * @returns Promise resolving to the transaction receipt
   * @throws Error if smart account client unavailable or transaction fails
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncApproval(work: any) {
    const smartAccountClient = this.getSmartAccountClient();

    const encodedAttestationData = encodeWorkApprovalData(work.data);
    const easConfig = getEASConfig("42161");

    const encodedData = encodeFunctionData({
      abi,
      functionName: "attest",
      args: [
        {
          schema: easConfig.WORK_APPROVAL.uid,
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
      to: easConfig.EAS.address as `0x${string}`,
      value: 0n,
      data: encodedData,
    });

    return receipt;
  }

  /**
   * Checks if there are any pending offline items waiting to be synced
   *
   * @returns Promise resolving to true if there are pending items
   */
  async hasPendingWork(): Promise<boolean> {
    const unsyncedWork = await offlineDB.getUnsyncedWork();
    return unsyncedWork.length > 0;
  }

  /**
   * Gets the count of pending offline items waiting to be synced
   *
   * @returns Promise resolving to the number of pending items
   */
  async getPendingCount(): Promise<number> {
    const unsyncedWork = await offlineDB.getUnsyncedWork();
    return unsyncedWork.length;
  }
}

/**
 * Default OfflineSync instance for use throughout the application
 *
 * This singleton instance should be used consistently across the app
 * to ensure proper state management and avoid duplicate sync operations.
 */
export const offlineSync = new OfflineSync();
