/**
 * Status Handler - Show current user status
 */

import type { InboundMessage } from "../contracts/message";
import type { HandlerResult } from "../contracts/response";
import type { StoragePort, User } from "../../ports/storage";
import { formatAddress } from "./utils";

export interface StatusDeps {
  storage: StoragePort;
  getRateLimitStats: (
    platformId: string,
    type: string
  ) => { remaining: number; limit: number };
}

/**
 * Handle /status command - show user status
 */
export async function handleStatus(
  message: InboundMessage,
  user: User,
  deps: StatusDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  const { storage, getRateLimitStats } = deps;

  const session = await storage.getSession(platform, sender.platformId);
  const rateLimitStats = getRateLimitStats(sender.platformId, "submission");

  return {
    response: {
      text:
        `📊 *Your Status*\n\n` +
        `*Wallet:* \`${user.address}\`\n` +
        `*Role:* ${user.role || "gardener"}\n` +
        `*Garden:* ${user.currentGarden ? `\`${formatAddress(user.currentGarden)}\`` : "_Not joined_"}\n` +
        `*Session:* ${session?.step || "idle"}\n` +
        `*Submissions remaining:* ${rateLimitStats.remaining}/${rateLimitStats.limit}`,
      parseMode: "markdown",
    },
  };
}

