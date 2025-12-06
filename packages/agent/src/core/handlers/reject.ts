/**
 * Reject Handler - Reject a pending work submission (operator only)
 */

import type { InboundMessage, CommandContent } from "../contracts/message";
import type { HandlerResult } from "../contracts/response";
import type { StoragePort, User } from "../../ports/storage";
import type { BlockchainPort } from "../../ports/blockchain";

export interface RejectDeps {
  storage: StoragePort;
  blockchain: BlockchainPort;
  notifyGardener?: (platform: string, platformId: string, message: string) => Promise<void>;
}

/**
 * Handle /reject command - reject a pending work submission
 */
export async function handleReject(
  message: InboundMessage,
  user: User,
  deps: RejectDeps
): Promise<HandlerResult> {
  const { content } = message;
  const { storage, blockchain, notifyGardener } = deps;

  // Extract work ID and reason from command args
  const commandContent = content as CommandContent;
  const workId = commandContent.args[0];
  const reason = commandContent.args.slice(1).join(" ") || "No reason provided";

  if (!workId) {
    return {
      response: {
        text:
          "📍 *Usage:* `/reject <WorkID> [reason]`\n\n" +
          "Example: `/reject abc123 Insufficient documentation`",
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
          `Only registered operators can reject work for this garden.`,
        parseMode: "markdown",
      },
    };
  }

  // Remove pending work
  await storage.removePendingWork(workId);

  // Notify gardener
  if (notifyGardener) {
    await notifyGardener(
      pendingWork.gardenerPlatform,
      pendingWork.gardenerPlatformId,
      `❌ *Your work has been rejected*\n\n` +
        `ID: \`${workId}\`\n` +
        `Reason: ${reason}\n\n` +
        `Please try again with more details or photos.`
    );
  }

  return {
    response: {
      text: `❌ Work ${workId} rejected.\n\nReason: ${reason}`,
    },
  };
}
