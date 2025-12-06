/**
 * Start Handler - Initialize user account and wallet
 */

import { privateKeyToAccount } from "viem/accounts";
import type { InboundMessage } from "../contracts/message";
import type { HandlerResult } from "../contracts/response";
import type { StoragePort } from "../../ports/storage";
import { formatAddress } from "./utils";

export interface StartDeps {
  storage: StoragePort;
  generatePrivateKey: () => `0x${string}`;
}

/**
 * Handle /start command - creates wallet for new users or welcomes back existing users
 */
export async function handleStart(
  message: InboundMessage,
  deps: StartDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  const { storage, generatePrivateKey } = deps;

  let user = await storage.getUser(platform, sender.platformId);

  if (!user) {
    // Create new custodial wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    user = await storage.createUser({
      platform,
      platformId: sender.platformId,
      privateKey,
      address: account.address,
      role: "gardener",
    });

    return {
      response: {
        text:
          `🌿 *Welcome to Green Goods!*\n\n` +
          `I've created a wallet for you:\n` +
          `\`${user.address}\`\n\n` +
          `*Commands:*\n` +
          `/join <address> - Join a garden\n` +
          `/status - Check your current status\n` +
          `/help - Show all commands\n\n` +
          `_Send me a text or voice message to submit work!_`,
        parseMode: "markdown",
      },
    };
  }

  return {
    response: {
      text:
        `🌿 *Welcome back!*\n\n` +
        `Wallet: \`${formatAddress(user.address)}\`\n` +
        `Garden: ${user.currentGarden ? `\`${formatAddress(user.currentGarden)}\`` : "_Not joined_"}\n\n` +
        `_Send me a message to submit work or use /help for commands._`,
      parseMode: "markdown",
    },
  };
}

