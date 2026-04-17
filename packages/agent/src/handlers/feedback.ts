/**
 * Feedback Handler - /bug and /idea commands
 *
 * Allows gardeners and operators to report bugs and share ideas.
 * Feedback is stored in the database for routine consumption via API.
 */

import * as db from "../services/db";
import { classifyError } from "../services/errors";
import { loggers } from "../services/logger";
import type { CommandContent, FeedbackType, HandlerResult, InboundMessage, User } from "../types";

const log = loggers.handlers;

// ============================================================================
// TYPES
// ============================================================================

export interface FeedbackDeps {
  generateId: () => string;
}

// ============================================================================
// HANDLER
// ============================================================================

const USAGE: Record<FeedbackType, string> = {
  bug: "Usage: `/bug <description>`\n\nExample: `/bug the map doesn't load on my phone`",
  idea: "Usage: `/idea <description>`\n\nExample: `/idea add a photo gallery for garden work`",
};

const ACK: Record<FeedbackType, string> = {
  bug: "Thanks for the report! We've logged this bug and the team will look into it.",
  idea: "Great idea! We've noted it and the team will review it.",
};

export async function handleFeedback(
  message: InboundMessage,
  user: User,
  type: FeedbackType,
  deps: FeedbackDeps
): Promise<HandlerResult> {
  const content = message.content as CommandContent;
  const text = content.args.join(" ").trim();

  if (!text) {
    return {
      response: {
        text: USAGE[type],
        parseMode: "markdown",
      },
    };
  }

  try {
    const feedback = await db.addFeedback({
      id: deps.generateId(),
      type,
      status: "new",
      text,
      platform: message.platform,
      platformId: message.sender.platformId,
      displayName: message.sender.displayName,
      gardenAddress: user.currentGarden,
    });

    return {
      response: {
        text: `${ACK[type]}\n\n_Reference: ${feedback.id.slice(0, 8)}_`,
        parseMode: "markdown",
      },
    };
  } catch (error) {
    const { category, userMessage } = classifyError(error);
    log.error({ err: error, category, type }, "Feedback storage error");
    return {
      response: {
        text: `Sorry, we couldn't save your ${type} report right now.\n\n${userMessage}\n\nPlease try again later.`,
      },
    };
  }
}
