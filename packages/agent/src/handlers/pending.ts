/**
 * Pending Handler - List pending work submissions (operator only)
 */

import * as db from "../services/db";
import type { HandlerResult, InboundMessage, User } from "../types";
import { formatAddress } from "./utils";

export async function handlePending(_message: InboundMessage, user: User): Promise<HandlerResult> {
  if (user.role !== "operator") {
    return {
      response: {
        text: "This command is only available for operators.",
      },
    };
  }

  if (!user.currentGarden) {
    return {
      response: {
        text: "Please join a garden first with /join <address>",
      },
    };
  }

  const pendingWorks = await db.getPendingWorksForGarden(user.currentGarden);

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
