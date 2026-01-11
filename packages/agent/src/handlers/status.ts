/**
 * Status Handler - Show current user status
 */

import * as db from "../services/db";
import type { HandlerResult, InboundMessage, User } from "../types";
import { formatAddress } from "./utils";

export interface StatusDeps {
  getRateLimitStats: (platformId: string, type: string) => { remaining: number; limit: number };
}

export async function handleStatus(
  message: InboundMessage,
  user: User,
  deps: StatusDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  const { getRateLimitStats } = deps;

  const session = await db.getSession(platform, sender.platformId);
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
