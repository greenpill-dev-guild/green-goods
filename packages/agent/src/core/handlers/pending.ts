/**
 * Pending Handler - List pending work submissions (operator only)
 */

import type { InboundMessage } from "../contracts/message";
import type { HandlerResult } from "../contracts/response";
import type { StoragePort, User } from "../../ports/storage";
import { formatAddress } from "./utils";

export interface PendingDeps {
  storage: StoragePort;
}

/**
 * Handle /pending command - list pending works for operator's garden
 */
export async function handlePending(
  message: InboundMessage,
  user: User,
  deps: PendingDeps
): Promise<HandlerResult> {
  const { storage } = deps;

  // Check if user is an operator
  if (user.role !== "operator") {
    return {
      response: {
        text: "This command is only available for operators.",
      },
    };
  }

  // Check if user has joined a garden
  if (!user.currentGarden) {
    return {
      response: {
        text: "Please join a garden first with /join <address>",
      },
    };
  }

  const pendingWorks = await storage.getPendingWorksForGarden(user.currentGarden);

  if (pendingWorks.length === 0) {
    return {
      response: {
        text: "No pending work submissions for your garden.",
      },
    };
  }

  let messageText = `📋 *Pending Work Submissions*\n\n`;

  for (const work of pendingWorks.slice(0, 10)) {
    messageText +=
      `*ID:* \`${work.id}\`\n` +
      `Gardener: \`${formatAddress(work.gardenerAddress)}\`\n` +
      `Title: ${work.data.title}\n` +
      `Plants: ${work.data.plantCount} (${work.data.plantSelection.join(", ")})\n\n`;
  }

  if (pendingWorks.length > 10) {
    messageText += `_...and ${pendingWorks.length - 10} more_\n\n`;
  }

  messageText += `Use \`/approve <id>\` or \`/reject <id>\` to process.`;

  return {
    response: {
      text: messageText,
      parseMode: "markdown",
    },
  };
}
