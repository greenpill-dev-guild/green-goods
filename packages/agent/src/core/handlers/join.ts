/**
 * Join Handler - Join a garden by address
 */

import type { InboundMessage, CommandContent } from "../contracts/message";
import type { HandlerResult } from "../contracts/response";
import type { StoragePort, User } from "../../ports/storage";
import type { BlockchainPort } from "../../ports/blockchain";
import { formatAddress } from "./utils";

export interface JoinDeps {
  storage: StoragePort;
  blockchain: BlockchainPort;
  isValidAddress: (address: string) => boolean;
}

/**
 * Handle /join command - join a garden by address
 */
export async function handleJoin(
  message: InboundMessage,
  user: User,
  deps: JoinDeps
): Promise<HandlerResult> {
  const { platform, sender, content } = message;
  const { storage, blockchain, isValidAddress } = deps;

  // Extract garden address from command args
  const commandContent = content as CommandContent;
  const gardenAddress = commandContent.args[0];

  if (!gardenAddress) {
    return {
      response: {
        text: "📍 *Usage:* `/join <GardenAddress>`\n\n" + "Example: `/join 0x1234...abcd`",
        parseMode: "markdown",
      },
    };
  }

  // Validate address format
  if (!isValidAddress(gardenAddress)) {
    return {
      response: {
        text:
          "❌ Invalid address format.\n\n" +
          "Please provide a valid Ethereum address (0x followed by 40 hex characters).",
      },
    };
  }

  // Verify garden exists on-chain
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

  // Update user's current garden
  await storage.updateUser(platform, sender.platformId, {
    currentGarden: gardenAddress,
  });

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
