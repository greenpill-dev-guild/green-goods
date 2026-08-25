/**
 * Help Handler - Show available commands
 */

import { agentMessage } from "../i18n";
import type { HandlerResult, InboundMessage, User } from "../types";

export async function handleHelp(
  message: InboundMessage,
  user: User | undefined
): Promise<HandlerResult> {
  const isSteward = user?.role === "steward";

  let helpText = agentMessage(message.locale, "help.basic");

  if (isSteward) {
    helpText += agentMessage(message.locale, "help.steward");
  }

  helpText += agentMessage(message.locale, "help.footer");

  return {
    response: {
      text: helpText,
      parseMode: "markdown",
    },
  };
}
