/**
 * Reject Handler - Reject a pending work submission (operator only)
 */

import { agentMessage } from "../i18n";
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
  const reason =
    commandContent.args.slice(1).join(" ") || agentMessage(message.locale, "reject.defaultReason");

  if (!workId) {
    return {
      response: {
        text: agentMessage(message.locale, "reject.usage"),
        parseMode: "markdown",
      },
    };
  }

  if (user.role !== "operator") {
    return {
      response: {
        text: agentMessage(message.locale, "reject.permission"),
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
        text: agentMessage(message.locale, "work.notFound"),
      },
    };
  }

  const gardenAddress = pendingWork.gardenAddress || user.currentGarden;
  if (!gardenAddress) {
    return {
      response: {
        text: agentMessage(message.locale, "work.cannotDetermineGarden"),
      },
    };
  }

  const verification = await blockchain.isOperator(gardenAddress, user.address);
  if (!verification.verified) {
    return {
      response: {
        text: agentMessage(message.locale, "reject.permissionWithReason", {
          reason: verification.reason,
        }),
        parseMode: "markdown",
      },
    };
  }

  try {
    const claimed = await claimMessageIdempotency("reject", message);
    if (!claimed) {
      return {
        response: idempotencyInProgressResponse("rejection", message.locale),
      };
    }

    const gardenerUser = notifyGardener
      ? await db.getUser(pendingWork.gardenerPlatform, pendingWork.gardenerPlatformId)
      : undefined;

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
        agentMessage(gardenerUser?.locale, "reject.notify", { workId, reason })
      );
    }

    const result = {
      response: {
        text: agentMessage(message.locale, "reject.success", { workId, reason }),
      },
    };

    await completeMessageIdempotency("reject", message, result.response);

    return result;
  } catch (error) {
    const { category, userMessage } = classifyError(error, message.locale);
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
