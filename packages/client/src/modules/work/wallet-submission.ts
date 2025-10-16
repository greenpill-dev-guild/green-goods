/**
 * Direct wallet submission module
 *
 * Enables wallet-authenticated users to submit work and approvals directly
 * via blockchain transactions, bypassing the job queue system.
 *
 * Use for:
 * - Wallet (EOA) authentication mode
 * - Online-only operations
 * - Traditional web3 UX (sign transaction, wait for confirmation)
 *
 * @module modules/work/wallet-submission
 */

import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import { encodeFunctionData } from "viem";
import { getWalletClient, waitForTransactionReceipt } from "@wagmi/core";
import { wagmiConfig } from "@/config/appkit";
import { getEASConfig } from "@/config/blockchain";
import { abi } from "@/utils/blockchain/abis/EAS.json";
import { encodeWorkData, encodeWorkApprovalData } from "@/utils/eas/encoders";
import { createLogger } from "@/utils/app/logger";

const logger = createLogger("WalletSubmission");

/**
 * Submit work directly using wallet client (no job queue)
 *
 * Process:
 * 1. Get wallet client from wagmi
 * 2. Encode work data (uploads media to IPFS)
 * 3. Prepare EAS attestation transaction
 * 4. Send transaction via wallet
 * 5. Wait for transaction receipt
 *
 * @param draft - Work form data
 * @param gardenAddress - Target garden address
 * @param actionUID - Action type identifier
 * @param actionTitle - Action title for metadata
 * @param chainId - Target chain ID
 * @param images - Work media files
 * @returns Transaction hash
 * @throws Error if wallet not connected or transaction fails
 */
export async function submitWorkDirectly(
  draft: WorkDraft,
  gardenAddress: string,
  actionUID: number,
  actionTitle: string,
  chainId: number,
  images: File[]
): Promise<`0x${string}`> {
  logger.log("Starting direct work submission", { gardenAddress, actionUID });

  // 1. Get wallet client from wagmi
  const walletClient = await getWalletClient(wagmiConfig, { chainId });
  if (!walletClient) {
    logger.error("Wallet client not available");
    throw new Error("Wallet not connected. Please connect your wallet and try again.");
  }

  try {
    // 2. Encode work data (uploads to IPFS internally)
    logger.log("Encoding work data and uploading to IPFS");
    const attestationData = await encodeWorkData(
      {
        ...draft,
        title: `${actionTitle} - ${new Date().toISOString()}`,
        actionUID,
        media: images,
      },
      chainId
    );

    // 3. Prepare EAS attestation transaction
    const easConfig = getEASConfig(chainId);
    const data = encodeFunctionData({
      abi,
      functionName: "attest",
      args: [
        {
          schema: easConfig.WORK.uid,
          data: {
            recipient: gardenAddress as `0x${string}`,
            expirationTime: NO_EXPIRATION,
            revocable: true,
            refUID: ZERO_BYTES32,
            data: attestationData,
            value: 0n,
          },
        },
      ],
    });

    logger.log("Sending transaction", { to: easConfig.EAS.address });

    // 4. Send transaction directly via wallet
    const hash = await walletClient.sendTransaction({
      to: easConfig.EAS.address as `0x${string}`,
      data,
      value: 0n,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    logger.log("Transaction sent", { hash });

    // 5. Wait for transaction receipt
    await waitForTransactionReceipt(wagmiConfig, { hash, chainId });

    logger.log("Transaction confirmed", { hash });
    return hash;
  } catch (err: any) {
    logger.error("Work submission failed", err);

    // Handle common wallet errors with user-friendly messages
    if (err.message?.includes("User rejected") || err.message?.includes("user rejected")) {
      throw new Error("Transaction cancelled by user");
    }
    if (err.message?.includes("insufficient funds")) {
      throw new Error("Insufficient funds for gas");
    }
    if (err.message?.includes("nonce")) {
      throw new Error("Transaction conflict - please try again");
    }
    if (err.message?.includes("network")) {
      throw new Error("Network error - please check your connection");
    }

    // Re-throw with original error for debugging
    throw new Error(`Transaction failed: ${err.message || "Unknown error"}`);
  }
}

/**
 * Submit work approval directly using wallet client (no job queue)
 *
 * Process:
 * 1. Get wallet client from wagmi
 * 2. Encode approval data
 * 3. Prepare EAS attestation transaction
 * 4. Send transaction via wallet
 * 5. Wait for transaction receipt
 *
 * @param draft - Approval form data
 * @param gardenerAddress - Gardener receiving the approval
 * @param chainId - Target chain ID
 * @returns Transaction hash
 * @throws Error if wallet not connected or transaction fails
 */
export async function submitApprovalDirectly(
  draft: WorkApprovalDraft,
  gardenerAddress: string,
  chainId: number
): Promise<`0x${string}`> {
  logger.log("Starting direct approval submission", { gardenerAddress });

  // 1. Get wallet client from wagmi
  const walletClient = await getWalletClient(wagmiConfig, { chainId });
  if (!walletClient) {
    logger.error("Wallet client not available");
    throw new Error("Wallet not connected. Please connect your wallet and try again.");
  }

  try {
    // 2. Encode approval data
    logger.log("Encoding approval data");
    const attestationData = encodeWorkApprovalData(draft, chainId);

    // 3. Prepare EAS attestation transaction
    const easConfig = getEASConfig(chainId);
    const data = encodeFunctionData({
      abi,
      functionName: "attest",
      args: [
        {
          schema: easConfig.WORK_APPROVAL.uid,
          data: {
            recipient: gardenerAddress as `0x${string}`,
            expirationTime: NO_EXPIRATION,
            revocable: true,
            refUID: ZERO_BYTES32,
            data: attestationData,
            value: 0n,
          },
        },
      ],
    });

    logger.log("Sending approval transaction", { to: easConfig.EAS.address });

    // 4. Send transaction directly via wallet
    const hash = await walletClient.sendTransaction({
      to: easConfig.EAS.address as `0x${string}`,
      data,
      value: 0n,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    logger.log("Approval transaction sent", { hash });

    // 5. Wait for transaction receipt
    await waitForTransactionReceipt(wagmiConfig, { hash, chainId });

    logger.log("Approval transaction confirmed", { hash });
    return hash;
  } catch (err: any) {
    logger.error("Approval submission failed", err);

    // Handle common wallet errors with user-friendly messages
    if (err.message?.includes("User rejected") || err.message?.includes("user rejected")) {
      throw new Error("Transaction cancelled by user");
    }
    if (err.message?.includes("insufficient funds")) {
      throw new Error("Insufficient funds for gas");
    }
    if (err.message?.includes("nonce")) {
      throw new Error("Transaction conflict - please try again");
    }
    if (err.message?.includes("network")) {
      throw new Error("Network error - please check your connection");
    }

    // Re-throw with original error for debugging
    throw new Error(`Transaction failed: ${err.message || "Unknown error"}`);
  }
}
