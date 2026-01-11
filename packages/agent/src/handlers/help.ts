/**
 * Help Handler - Show available commands
 */

import type { InboundMessage, User, HandlerResult } from "../types";

export async function handleHelp(
  _message: InboundMessage,
  user: User | undefined
): Promise<HandlerResult> {
  const isOperator = user?.role === "operator";

  let helpText =
    `🌿 *Green Goods Bot Help*\n\n` +
    `*Basic Commands:*\n` +
    `/start - Create wallet & get started\n` +
    `/join <address> - Join a garden\n` +
    `/status - Check your current status\n\n` +
    `*Submitting Work:*\n` +
    `Simply send a text or voice message describing your work!\n` +
    `Example: "I planted 5 trees today"\n\n`;

  if (isOperator) {
    helpText +=
      `*Operator Commands:*\n` +
      `/approve <id> - Approve a work submission\n` +
      `/reject <id> - Reject a work submission\n` +
      `/pending - List pending work for your garden\n\n`;
  }

  helpText += `_Need help? Contact @GreenGoodsSupport_`;

  return {
    response: {
      text: helpText,
      parseMode: "markdown",
    },
  };
}
