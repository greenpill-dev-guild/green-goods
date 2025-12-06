/**
 * Approve Handler - Approve a pending work submission (operator only)
 */

import type { Hex } from "viem";
import type { InboundMessage, CommandContent } from "../contracts/message";
import type { HandlerResult } from "../contracts/response";
import type { StoragePort, User } from "../../ports/storage";
import type { BlockchainPort } from "../../ports/blockchain";

export interface ApproveDeps {
  storage: StoragePort;
  blockchain: BlockchainPort;
  notifyGardener?: (
    platform: string,
    platformId: string,
    message: string
  ) => Promise<void>;
}

/**
 * Handle /approve command - approve a pending work submission
 */
export async function handleApprove(
  message: InboundMessage,
  user: User,
  deps: ApproveDeps
): Promise<HandlerResult> {
  const { content } = message;
  const { storage, blockchain, notifyGardener } = deps;

  // Extract work ID from command args
  const commandContent = content as CommandContent;
  const workId = commandContent.args[0];

  if (!workId) {
    return {
      response: {
        text:
          "📍 *Usage:* `/approve <WorkID>`\n\nExample: `/approve abc123`",
        parseMode: "markdown",
      },
    };
  }

  // Get pending work
  const pendingWork = await storage.getPendingWork(workId);
  if (!pendingWork) {
    return {
      response: {
        text: "❌ Work not found or already processed.",
      },
    };
  }

  // Determine garden address
  const gardenAddress = pendingWork.gardenAddress || user.currentGarden;
  if (!gardenAddress) {
    return {
      response: {
        text: "❌ Cannot determine garden for this work.",
      },
    };
  }

  // Verify user is an operator for the garden
  const verification = await blockchain.isOperator(gardenAddress, user.address);
  if (!verification.verified) {
    return {
      response: {
        text:
          `❌ *Permission Denied*\n\n${verification.reason}\n\n` +
          `Only registered operators can approve work for this garden.`,
        parseMode: "markdown",
      },
    };
  }

  try {
    // Submit work attestation on-chain
    const tx = await blockchain.submitWork({
      privateKey: user.privateKey as Hex,
      gardenAddress,
      actionUID: pendingWork.actionUID,
      actionTitle: "Work Submission",
      workData: {
        title: pendingWork.data.title,
        plantSelection: pendingWork.data.plantSelection,
        plantCount: pendingWork.data.plantCount,
        feedback: pendingWork.data.feedback,
      },
    });

    // Remove pending work
    await storage.removePendingWork(workId);

    // Notify gardener
    if (notifyGardener) {
      await notifyGardener(
        pendingWork.gardenerPlatform,
        pendingWork.gardenerPlatformId,
        `🎉 *Your work has been approved!*\n\n` +
          `ID: \`${workId}\`\n` +
          `Tx: \`${tx}\``
      );
    }

    return {
      response: {
        text: `✅ *Work approved and attested!*\n\nTx: \`${tx}\``,
        parseMode: "markdown",
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Approval error:", error);

    return {
      response: {
        text: `❌ Error approving: ${errorMessage}`,
      },
    };
  }
}

