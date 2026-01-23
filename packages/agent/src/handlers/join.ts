/**
 * Join Handler - Join a garden by address
 */

import * as blockchain from "../services/blockchain";
import * as db from "../services/db";
import type { CommandContent, HandlerResult, InboundMessage, User } from "../types";
import { formatAddress } from "./utils";

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
        text: "📍 *Usage:* `/join <GardenAddress>`\n\nExample: `/join 0x1234...abcd`",
        parseMode: "markdown",
      },
    };
  }

  if (!isValidAddress(gardenAddress)) {
    return {
      response: {
        text:
          "❌ Invalid address format.\n\n" +
          "Please provide a valid Ethereum address (0x followed by 40 hex characters).",
      },
    };
  }

  const gardenInfo = await blockchain.getGardenInfo(gardenAddress);

  if (!gardenInfo?.exists) {
    return {
      response: {
        text:
          "❌ *Garden not found*\n\n" +
          "This address doesn't appear to be a valid Green Goods garden contract.\n\n" +
          "Please verify the address and try again.",
        parseMode: "markdown",
      },
    };
  }

  await db.updateUser(platform, sender.platformId, { currentGarden: gardenAddress });

  return {
    response: {
      text:
        `✅ *Joined garden successfully!*\n\n` +
        `Garden: ${gardenInfo.name ? `*${gardenInfo.name}*` : ""}\n` +
        `Address: \`${formatAddress(gardenAddress)}\`\n\n` +
        `You can now submit work by sending me a text or voice message.`,
      parseMode: "markdown",
    },
  };
}
