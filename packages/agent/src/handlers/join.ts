/**
 * Join Handler - Join a garden by address
 */

import { agentMessage } from "../i18n";
import * as blockchain from "../services/blockchain";
import * as db from "../services/db";
import { classifyError } from "../services/errors";
import { loggers } from "../services/logger";
import type { CommandContent, HandlerResult, InboundMessage, User } from "../types";
import { formatAddress } from "./utils";

const log = loggers.handlers;

export interface JoinDeps {
  isValidAddress: (address: string) => boolean;
}

export async function handleJoin(
  message: InboundMessage,
  user: User,
  deps: JoinDeps
): Promise<HandlerResult> {
  const { platform, sender, content } = message;
  const { isValidAddress } = deps;

  const commandContent = content as CommandContent;
  const gardenAddress = commandContent.args[0];

  if (!gardenAddress) {
    return {
      response: {
        text: agentMessage(message.locale, "join.usage"),
        parseMode: "markdown",
      },
    };
  }

  if (!isValidAddress(gardenAddress)) {
    return {
      response: {
        text: agentMessage(message.locale, "join.invalidAddress"),
      },
    };
  }

  try {
    const gardenInfo = await blockchain.getGardenInfo(gardenAddress);

    if (!gardenInfo?.exists) {
      return {
        response: {
          text: agentMessage(message.locale, "join.notFound"),
          parseMode: "markdown",
        },
      };
    }

    await db.updateUser(platform, sender.platformId, { currentGarden: gardenAddress });

    return {
      response: {
        text: agentMessage(message.locale, "join.success", {
          gardenName: gardenInfo.name ? `*${gardenInfo.name}*` : "",
          gardenAddress: formatAddress(gardenAddress),
        }),
        parseMode: "markdown",
      },
    };
  } catch (error) {
    const { category, userMessage } = classifyError(error, message.locale);
    log.error({ err: error, category, gardenAddress }, "Garden join lookup error");

    return {
      response: {
        text: `❌ ${userMessage}`,
      },
    };
  }
}
