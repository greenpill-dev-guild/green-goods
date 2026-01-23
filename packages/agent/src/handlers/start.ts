/**
 * Start Handler - Initialize user account and wallet
 */

import { privateKeyToAccount } from "viem/accounts";
import * as db from "../services/db";
import type { HandlerResult, InboundMessage } from "../types";
import { formatAddress } from "./utils";

export interface StartDeps {
  generatePrivateKey: () => `0x${string}`;
}

export async function handleStart(
  message: InboundMessage,
  deps: StartDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  const { generatePrivateKey } = deps;

  let user = await db.getUser(platform, sender.platformId);

  if (!user) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    user = await db.createUser({
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
