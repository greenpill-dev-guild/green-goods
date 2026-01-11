/**
 * Handler Registry & Message Router
 *
 * Central routing for all message types. Platform adapters call handleMessage().
 */

import { generateSecureId, generateSecurePrivateKey, isValidAddress } from "../services/crypto";
import * as db from "../services/db";
import { loggers } from "../services/logger";
import { type RateLimitType, rateLimiter } from "../services/rate-limiter";

const log = loggers.handlers;

import {
  type CallbackContent,
  type CommandContent,
  type ImageContent,
  type InboundMessage,
  isCallbackContent,
  isCommandContent,
  isImageContent,
  isTextContent,
  isVoiceContent,
  type OutboundResponse,
  type SessionStep,
  textResponse,
  type User,
  type VoiceContent,
} from "../types";
import { handleApprove } from "./approve";
import { handleHelp } from "./help";
import { handleJoin } from "./join";
import { handlePending } from "./pending";
import { handleReject } from "./reject";
// Import individual handlers
import { handleStart } from "./start";
import { handleStatus } from "./status";
import {
  handleCancelSubmission,
  handleConfirmSubmission,
  handleTextSubmission,
  handleVoiceSubmission,
} from "./submit";

// ============================================================================
// TYPES
// ============================================================================

export interface HandlerContext {
  voiceProcessor?: {
    downloadAndTranscribe: (audioUrl: string) => Promise<string>;
  };
  photoProcessor?: {
    downloadPhoto: (fileId: string) => Promise<Buffer>;
  };
  notifier?: {
    notify: (platform: string, platformId: string, message: string) => Promise<void>;
  };
}

// ============================================================================
// MESSAGE ROUTER
// ============================================================================

let _context: HandlerContext = {};

/**
 * Set the handler context (voice processor, notifier, etc.)
 */
export function setHandlerContext(ctx: HandlerContext): void {
  _context = ctx;
}

/**
 * Main entry point for all messages. Platform adapters call this.
 */
export async function handleMessage(message: InboundMessage): Promise<OutboundResponse> {
  const { platform, sender, content } = message;

  // Get user (may be undefined for /start and /help)
  const user = await db.getUser(platform, sender.platformId);

  // Route based on content type
  if (isCommandContent(content)) {
    return handleCommand(message, user);
  }

  if (isCallbackContent(content)) {
    return handleCallback(message, user);
  }

  if (isVoiceContent(content)) {
    return handleVoice(message, user);
  }

  if (isImageContent(content)) {
    return handlePhoto(message, user);
  }

  if (isTextContent(content)) {
    return handleText(message, user);
  }

  return textResponse("❌ Unsupported message type.");
}

// ============================================================================
// COMMAND HANDLER
// ============================================================================

async function handleCommand(
  message: InboundMessage,
  user: User | undefined
): Promise<OutboundResponse> {
  const { sender, content } = message;
  const command = (content as CommandContent).name.toLowerCase();

  // Commands that don't require user
  if (command === "start") {
    const rateCheck = checkRateLimit(sender.platformId, "wallet");
    if (rateCheck) return rateCheck;

    const result = await handleStart(message, { generatePrivateKey: generateSecurePrivateKey });
    return result.response;
  }

  if (command === "help") {
    const result = await handleHelp(message, user);
    return result.response;
  }

  // All other commands require user
  if (!user) {
    return textResponse("Please run /start first to create your wallet.");
  }

  const rateCheck = checkRateLimit(sender.platformId, "command");
  if (rateCheck) return rateCheck;

  switch (command) {
    case "join": {
      const result = await handleJoin(message, user, { isValidAddress });
      return result.response;
    }

    case "status": {
      const result = await handleStatus(message, user, {
        getRateLimitStats: (platformId, type) =>
          rateLimiter.peek(platformId, type as RateLimitType),
      });
      return result.response;
    }

    case "pending": {
      const result = await handlePending(message, user);
      return result.response;
    }

    case "approve": {
      const approvalRateCheck = checkRateLimit(sender.platformId, "approval");
      if (approvalRateCheck) return approvalRateCheck;

      const result = await handleApprove(message, user, {
        notifyGardener: _context.notifier?.notify.bind(_context.notifier),
      });
      return result.response;
    }

    case "reject": {
      const approvalRateCheck = checkRateLimit(sender.platformId, "approval");
      if (approvalRateCheck) return approvalRateCheck;

      const result = await handleReject(message, user, {
        notifyGardener: _context.notifier?.notify.bind(_context.notifier),
      });
      return result.response;
    }

    default:
      return textResponse(`Unknown command: /${command}`);
  }
}

// ============================================================================
// CALLBACK HANDLER
// ============================================================================

async function handleCallback(
  message: InboundMessage,
  user: User | undefined
): Promise<OutboundResponse> {
  const { platform, sender, content } = message;
  const callbackData = (content as CallbackContent).data;

  if (!user) {
    return textResponse("Session expired. Please start again with /start");
  }

  const session = await db.getSession(platform, sender.platformId);

  switch (callbackData) {
    case "confirm_submission": {
      if (!session) {
        return textResponse("Session expired. Please submit your work again.");
      }

      const rateCheck = checkRateLimit(sender.platformId, "submission");
      if (rateCheck) return rateCheck;

      const result = await handleConfirmSubmission(message, user, session, {
        generateId: generateSecureId,
        notifyOperator: _context.notifier
          ? async (_operatorId, msg) => {
              const operator = await db.getOperatorForGarden(user.currentGarden!);
              if (operator) {
                await _context.notifier!.notify(operator.platform, operator.platformId, msg);
              }
            }
          : undefined,
      });

      await applySessionUpdates(platform, sender.platformId, result);
      return result.response;
    }

    case "cancel_submission": {
      const result = await handleCancelSubmission(message, { generateId: generateSecureId });
      return result.response;
    }

    default:
      return textResponse("Unknown action.");
  }
}

// ============================================================================
// VOICE HANDLER
// ============================================================================

async function handleVoice(
  message: InboundMessage,
  user: User | undefined
): Promise<OutboundResponse> {
  const { platform, sender, content } = message;

  if (!user) {
    return textResponse("Please run /start first to create your wallet.");
  }

  if (!user.currentGarden) {
    return textResponse("Please join a garden first with `/join <GardenAddress>`");
  }

  const rateCheck = checkRateLimit(sender.platformId, "voice");
  if (rateCheck) return rateCheck;

  if (!_context.voiceProcessor) {
    return textResponse("Voice processing is not available. Please send a text message instead.");
  }

  try {
    const voiceContent = content as VoiceContent;
    const transcribedText = await _context.voiceProcessor.downloadAndTranscribe(
      voiceContent.audioUrl
    );

    const result = await handleVoiceSubmission(message, user, transcribedText, {
      generateId: generateSecureId,
    });

    await applySessionUpdates(platform, sender.platformId, result);
    return result.response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error({ err: error }, "Voice processing error");
    return textResponse(
      `❌ Sorry, I couldn't process that audio.\n\n` +
        `Error: ${errorMessage}\n\n` +
        `Try sending a text message instead.`
    );
  }
}

// ============================================================================
// TEXT HANDLER
// ============================================================================

async function handleText(
  message: InboundMessage,
  user: User | undefined
): Promise<OutboundResponse> {
  const { platform, sender } = message;

  if (!user) {
    return textResponse("Please run /start first to create your wallet.");
  }

  if (!user.currentGarden) {
    return textResponse("Please join a garden first with `/join <GardenAddress>`");
  }

  const rateCheck = checkRateLimit(sender.platformId, "message");
  if (rateCheck) return rateCheck;

  try {
    const result = await handleTextSubmission(message, user, { generateId: generateSecureId });

    await applySessionUpdates(platform, sender.platformId, result);
    return result.response;
  } catch (error) {
    log.error({ err: error }, "Text processing error");
    return textResponse("❌ Sorry, I couldn't process that message. Please try again.");
  }
}

// ============================================================================
// PHOTO HANDLER
// ============================================================================

async function handlePhoto(
  message: InboundMessage,
  user: User | undefined
): Promise<OutboundResponse> {
  const { platform, sender, content } = message;

  if (!user) {
    return textResponse("Please run /start first to create your wallet.");
  }

  if (!user.currentGarden) {
    return textResponse("Please join a garden first with `/join <GardenAddress>`");
  }

  const rateCheck = checkRateLimit(sender.platformId, "message");
  if (rateCheck) return rateCheck;

  if (!_context.photoProcessor) {
    return textResponse(
      "📷 Photo processing is not available.\n\n" +
        "Please describe your work in a text message instead."
    );
  }

  try {
    const imageContent = content as ImageContent;
    const photoBuffer = await _context.photoProcessor.downloadPhoto(imageContent.imageUrl);

    // Get the current session to see if we have a pending draft
    const session = await db.getSession(platform, sender.platformId);

    if (session?.step === "awaiting_photo") {
      // User was prompted for photo - attach to existing draft
      const draft = session.draft as { photos?: Buffer[]; [key: string]: unknown } | undefined;
      const existingPhotos = draft?.photos || [];

      await db.setSession({
        platform,
        platformId: sender.platformId,
        step: "confirming_work",
        draft: {
          ...draft,
          photos: [...existingPhotos, photoBuffer],
        },
        updatedAt: Date.now(),
      });

      const photoCount = existingPhotos.length + 1;
      return textResponse(
        `📷 Photo ${photoCount} received!\n\n` +
          `Send another photo or tap *Confirm* when ready to submit.`,
        "markdown"
      );
    }

    // New photo submission - start a new draft with caption as description
    const caption = imageContent.caption || "";

    await db.setSession({
      platform,
      platformId: sender.platformId,
      step: "awaiting_details",
      draft: {
        photos: [photoBuffer],
        description: caption,
        gardenAddress: user.currentGarden,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return textResponse(
      `📷 *Photo received!*\n\n` +
        (caption ? `Caption: "${caption}"\n\n` : "") +
        `Please describe what work you did. For example:\n` +
        `_"Planted 5 oak trees in the community garden"_`,
      "markdown"
    );
  } catch (error) {
    log.error({ err: error }, "Photo processing error");
    return textResponse(
      "❌ Sorry, I couldn't process that photo.\n\n" + "Please try again or send a text message."
    );
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function checkRateLimit(platformId: string, type: string): OutboundResponse | undefined {
  const result = rateLimiter.check(platformId, type as RateLimitType);
  if (!result.allowed) {
    const waitTime = formatWaitTime(result.resetIn);
    return textResponse(`⏳ ${result.message}\n\nPlease wait ${waitTime} before trying again.`);
  }
  return undefined;
}

function formatWaitTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

async function applySessionUpdates(
  platform: string,
  platformId: string,
  result: { updateSession?: { step?: string; draft?: unknown }; clearSession?: boolean }
): Promise<void> {
  if (result.clearSession) {
    await db.clearSession(platform as "telegram" | "discord" | "whatsapp" | "sms", platformId);
  } else if (result.updateSession) {
    await db.setSession({
      platform: platform as "telegram" | "discord" | "whatsapp" | "sms",
      platformId,
      step: (result.updateSession.step || "idle") as SessionStep,
      draft: result.updateSession.draft,
      updatedAt: Date.now(),
    });
  }
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { handleApprove } from "./approve";
export { handleHelp } from "./help";
export { handleJoin } from "./join";
export { handlePending } from "./pending";
export { handleReject } from "./reject";
export { handleStart } from "./start";
export { handleStatus } from "./status";
export {
  handleCancelSubmission,
  handleConfirmSubmission,
  handleTextSubmission,
  handleVoiceSubmission,
} from "./submit";
