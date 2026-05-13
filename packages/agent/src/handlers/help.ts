/**
 * Help Handler - Show available commands
 */

import { agentMessage } from "../i18n";
import type { HandlerResult, InboundMessage, User } from "../types";

export async function handleHelp(
  message: InboundMessage,
  user: User | undefined
): Promise<HandlerResult> {
  const isOperator = user?.role === "operator";

  let helpText = agentMessage(message.locale, "help.basic");

  if (isOperator) {
    helpText += agentMessage(message.locale, "help.operator");
  }

  helpText += agentMessage(message.locale, "help.footer");

  return {
    response: {
      text: helpText,
      parseMode: "markdown",
    },
  };
}
