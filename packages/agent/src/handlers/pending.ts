/**
 * Pending Handler - List pending work submissions (operator only)
 */

import { agentMessage } from "../i18n";
import * as db from "../services/db";
import type { HandlerResult, InboundMessage, User } from "../types";
import { formatAddress } from "./utils";

export async function handlePending(message: InboundMessage, user: User): Promise<HandlerResult> {
  if (user.role !== "operator") {
    return {
      response: {
        text: agentMessage(message.locale, "pending.operatorOnly"),
      },
    };
  }

  if (!user.currentGarden) {
    return {
      response: {
        text: agentMessage(message.locale, "common.joinFirstAddress"),
      },
    };
  }

  const pendingWorks = await db.getPendingWorksForGarden(user.currentGarden);

  if (pendingWorks.length === 0) {
    return {
      response: {
        text: agentMessage(message.locale, "pending.empty"),
      },
    };
  }

  let messageText = agentMessage(message.locale, "pending.titleHeader");

  for (const work of pendingWorks.slice(0, 10)) {
    messageText +=
      `*ID:* \`${work.id}\`\n` +
      `${agentMessage(message.locale, "pending.gardener")}: \`${formatAddress(work.gardenerAddress)}\`\n` +
      `${agentMessage(message.locale, "pending.title")}: ${work.data.title}\n` +
      `${agentMessage(message.locale, "pending.plants")}: ${work.data.plantCount} (${work.data.plantSelection.join(", ")})\n\n`;
  }

  if (pendingWorks.length > 10) {
    messageText += agentMessage(message.locale, "pending.more", {
      count: pendingWorks.length - 10,
    });
  }

  messageText += agentMessage(message.locale, "pending.footer");

  return {
    response: {
      text: messageText,
      parseMode: "markdown",
    },
  };
}
