/**
 * Reject Handler - Reject a pending work submission (operator only)
 */

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

  if (user.role !== "operator") {
    return {
      response: {
        text:
          `❌ *Permission Denied*\n\n` +
          `Only registered operators can reject work for this garden.`,
        parseMode: "markdown",
      },
    };
  }

  const idempotencyResponse = await getExistingIdempotencyResponse("reject", message, "rejection");
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
          `Only registered operators can reject work for this garden.`,
        parseMode: "markdown",
      },
    };
  }

  try {
    const claimed = await claimMessageIdempotency("reject", message);
    if (!claimed) {
      return {
        response: idempotencyInProgressResponse("rejection"),
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

    const result = {
      response: {
        text: `❌ Work ${workId} rejected.\n\nReason: ${reason}`,
      },
    };

    await completeMessageIdempotency("reject", message, result.response);

    return result;
  } catch (error) {
    const { category, userMessage } = classifyError(error);
    log.error({ err: error, category, workId }, "Rejection error");

    const result = {
      response: {
        text: `❌ ${userMessage}`,
      },
    };

    await completeMessageIdempotency("reject", message, result.response);

    return result;
  }
}
