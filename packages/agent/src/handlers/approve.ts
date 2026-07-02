/**
 * Approve Handler - Approve a pending work submission (operator only)
 */

import type { Hex } from "viem";
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
const PROTOCOL_WORK_ACTION_TITLE = "Work Submission";
const PROTOCOL_APPROVAL_FEEDBACK = "Approved via bot";

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
        text: agentMessage(message.locale, "approve.usage"),
        parseMode: "markdown",
      },
    };
  }

  if (user.role !== "operator") {
    return {
      response: {
        text: agentMessage(message.locale, "approve.permission"),
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
        text: agentMessage(message.locale, "approve.permissionWithReason", {
          reason: verification.reason,
        }),
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
        text: agentMessage(message.locale, "approve.gardenerMissing"),
      },
    };
  }

  try {
    const claimed = await claimMessageIdempotency("approve", message);
    if (!claimed) {
      return {
        response: idempotencyInProgressResponse("approval", message.locale),
      };
    }

    // Step 1: Submit work using GARDENER's key (they are the work attester)
    // This prevents self-attestation: work.attester != approval.attester
    const { txHash: workTx, workUID } = await blockchain.submitWork({
      privateKey: gardenerUser.privateKey as Hex,
      gardenAddress,
      actionUID: pendingWork.actionUID,
      actionTitle: PROTOCOL_WORK_ACTION_TITLE,
      workData: {
        title: pendingWork.data.title,
        plantSelection: pendingWork.data.plantSelection,
        plantCount: pendingWork.data.plantCount,
        feedback: pendingWork.data.feedback,
      },
    });

    // Step 2: Approve using OPERATOR's key (different attester = no self-attestation).
    // Recipient = garden and workUID = the on-chain attestation UID, so the approval is
    // visible and linkable to every EAS consumer (dashboard Needs Review, arrival toast).
    const approvalTx = await blockchain.submitApproval({
      privateKey: user.privateKey as Hex,
      gardenAddress,
      actionUID: pendingWork.actionUID,
      workUID,
      approved: true,
      feedback: PROTOCOL_APPROVAL_FEEDBACK,
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
        workUID,
        approvalTx,
      }
    );

    if (notifyGardener) {
      await notifyGardener(
        pendingWork.gardenerPlatform,
        pendingWork.gardenerPlatformId,
        agentMessage(gardenerUser.locale, "notification.approved", { workId, workTx })
      );
    }

    const result = {
      response: {
        text: agentMessage(message.locale, "approve.success", { workTx, approvalTx }),
        parseMode: "markdown" as const,
      },
    };

    await completeMessageIdempotency("approve", message, result.response);

    return result;
  } catch (error) {
    const { category, userMessage } = classifyError(error, message.locale);
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
