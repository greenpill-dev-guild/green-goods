/**
 * Reject Handler - Reject a pending work submission (operator only)
 */

import * as blockchain from "../services/blockchain";
import * as db from "../services/db";
import { auditLog } from "../services/logger";
import type { CommandContent, HandlerResult, InboundMessage, User } from "../types";

export interface RejectDeps {
  notifyGardener?: (platform: string, platformId: string, message: string) => Promise<void>;
}

export async function handleReject(
  message: InboundMessage,
  user: User,
  deps: RejectDeps
): Promise<HandlerResult> {
  const { content } = message;
  const { notifyGardener } = deps;

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

  const pendingWork = await db.getPendingWork(workId);
  if (!pendingWork) {
    return {
      response: {
        text: "❌ Work not found or already processed.",
      },
    };
  }

  const gardenAddress = pendingWork.gardenAddress || user.currentGarden;
  if (!gardenAddress) {
    return {
      response: {
        text: "❌ Cannot determine garden for this work.",
      },
    };
  }

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

  await db.removePendingWork(workId);

  // Audit log the rejection
  auditLog(
    "operator:reject",
    { platform: message.platform, platformId: message.sender.platformId, address: user.address },
    {
      workId,
      gardenAddress,
      gardenerAddress: pendingWork.gardenerAddress,
      actionUID: pendingWork.actionUID,
      reason,
    }
  );

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
