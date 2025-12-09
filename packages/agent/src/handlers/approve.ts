/**
 * Approve Handler - Approve a pending work submission (operator only)
 */

import type { Hex } from "viem";
import * as blockchain from "../services/blockchain";
import * as db from "../services/db";
import { auditLog, loggers } from "../services/logger";
import type { CommandContent, HandlerResult, InboundMessage, User } from "../types";

const log = loggers.handlers;

export interface ApproveDeps {
  notifyGardener?: (platform: string, platformId: string, message: string) => Promise<void>;
}

export async function handleApprove(
  message: InboundMessage,
  user: User,
  deps: ApproveDeps
): Promise<HandlerResult> {
  const { content } = message;
  const { notifyGardener } = deps;

  const commandContent = content as CommandContent;
  const workId = commandContent.args[0];

  if (!workId) {
    return {
      response: {
        text: "📍 *Usage:* `/approve <WorkID>`\n\nExample: `/approve abc123`",
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
          `Only registered operators can approve work for this garden.`,
        parseMode: "markdown",
      },
    };
  }

  try {
    // Step 1: Submit the work to blockchain (operator sponsors gas)
    const workTx = await blockchain.submitWork({
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

    // Step 2: Create approval attestation
    const approvalTx = await blockchain.submitApproval({
      privateKey: user.privateKey as Hex,
      gardenerAddress: pendingWork.gardenerAddress,
      actionUID: pendingWork.actionUID,
      workUID: workId, // Local work ID for reference
      approved: true,
      feedback: "Approved via bot",
    });

    await db.removePendingWork(workId);

    // Audit log the approval
    auditLog(
      "operator:approve",
      { platform: message.platform, platformId: message.sender.platformId, address: user.address },
      {
        workId,
        gardenAddress,
        gardenerAddress: pendingWork.gardenerAddress,
        actionUID: pendingWork.actionUID,
        workTx,
        approvalTx,
      }
    );

    if (notifyGardener) {
      await notifyGardener(
        pendingWork.gardenerPlatform,
        pendingWork.gardenerPlatformId,
        `🎉 *Your work has been approved!*\n\nID: \`${workId}\`\nWork Tx: \`${workTx}\``
      );
    }

    return {
      response: {
        text:
          `✅ *Work approved and attested!*\n\n` +
          `Work Tx: \`${workTx}\`\n` +
          `Approval Tx: \`${approvalTx}\``,
        parseMode: "markdown",
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error({ err: error, workId }, "Approval error");

    return {
      response: {
        text: `❌ Error approving: ${errorMessage}`,
      },
    };
  }
}
