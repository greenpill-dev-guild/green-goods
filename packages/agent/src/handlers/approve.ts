/**
 * Approve Handler - Approve a pending work submission (operator only)
 */

import type { Hex } from "viem";
import * as blockchain from "../services/blockchain";
import * as db from "../services/db";
import { classifyError } from "../services/errors";
import { auditLog, loggers } from "../services/logger";
import type { CommandContent, HandlerResult, InboundMessage, User } from "../types";
import {
  claimMessageIdempotency,
  completeMessageIdempotency,
  getExistingIdempotencyResponse,
  idempotencyInProgressResponse,
} from "./idempotency";

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

  if (user.role !== "operator") {
    return {
      response: {
        text:
          `❌ *Permission Denied*\n\n` +
          `Only registered operators can approve work for this garden.`,
        parseMode: "markdown",
      },
    };
  }

  const idempotencyResponse = await getExistingIdempotencyResponse("approve", message, "approval");
  if (idempotencyResponse) {
    return { response: idempotencyResponse };
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

  // Look up gardener's bot-managed key for work submission
  // Gardeners on SMS/WhatsApp may not have smartphones — the bot holds
  // their custodial key and executes on their behalf.
  const gardenerUser = await db.getUser(
    pendingWork.gardenerPlatform,
    pendingWork.gardenerPlatformId
  );
  if (!gardenerUser) {
    return {
      response: {
        text: "❌ Gardener account not found. They may need to run /start first.",
      },
    };
  }

  try {
    const claimed = await claimMessageIdempotency("approve", message);
    if (!claimed) {
      return {
        response: idempotencyInProgressResponse("approval"),
      };
    }

    // Step 1: Submit work using GARDENER's key (they are the work attester)
    // This prevents self-attestation: work.attester != approval.attester
    const workTx = await blockchain.submitWork({
      privateKey: gardenerUser.privateKey as Hex,
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

    // Step 2: Approve using OPERATOR's key (different attester = no self-attestation)
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

    const result = {
      response: {
        text:
          `✅ *Work approved and attested!*\n\n` +
          `Work Tx: \`${workTx}\`\n` +
          `Approval Tx: \`${approvalTx}\``,
        parseMode: "markdown" as const,
      },
    };

    await completeMessageIdempotency("approve", message, result.response);

    return result;
  } catch (error) {
    const { category, userMessage } = classifyError(error);
    log.error({ err: error, category, workId }, "Approval error");

    const result = {
      response: {
        text: `❌ ${userMessage}`,
      },
    };

    await completeMessageIdempotency("approve", message, result.response);

    return result;
  }
}
