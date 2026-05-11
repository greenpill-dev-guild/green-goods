/**
 * Status Handler - Show current user status
 */

import { agentMessage, agentRoleLabel, agentSessionLabel } from "../i18n";
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
      text: agentMessage(message.locale, "status.title", {
        wallet: user.address,
        role: agentRoleLabel(message.locale, user.role),
        garden: user.currentGarden
          ? `\`${formatAddress(user.currentGarden)}\``
          : agentMessage(message.locale, "start.notJoined"),
        session: agentSessionLabel(message.locale, session?.step),
        remaining: rateLimitStats.remaining,
        limit: rateLimitStats.limit,
      }),
      parseMode: "markdown",
    },
  };
}
