/**
 * Start Handler - Initialize user account and wallet
 */

import { privateKeyToAccount } from "viem/accounts";
import { agentMessage } from "../i18n";
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
      locale: message.locale,
    });

    return {
      response: {
        text: agentMessage(message.locale, "start.welcomeNew", { address: user.address }),
        parseMode: "markdown",
      },
    };
  }

  if (message.locale && user.locale !== message.locale) {
    await db.updateUser(platform, sender.platformId, { locale: message.locale });
    user = { ...user, locale: message.locale };
  }

  return {
    response: {
      text: agentMessage(message.locale, "start.welcomeBack", {
        wallet: formatAddress(user.address),
        garden: user.currentGarden
          ? `\`${formatAddress(user.currentGarden)}\``
          : agentMessage(message.locale, "start.notJoined"),
      }),
      parseMode: "markdown",
    },
  };
}
