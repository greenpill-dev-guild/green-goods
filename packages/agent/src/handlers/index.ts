/**
 * Handler Registry & Message Router
 *
 * Central routing for all message types. Platform adapters call handleMessage().
 */

import { checkMessageContent } from "../services/content-filter";
import { generateSecureId, generateSecurePrivateKey, isValidAddress } from "../services/crypto";
import { agentMessage, agentRateLimitMessage, formatAgentWaitTime } from "../i18n";
import * as db from "../services/db";
import { classifyError } from "../services/errors";
import { loggers } from "../services/logger";
import { type RateLimitType, rateLimiter } from "../services/rate-limiter";
import {
  responseHasButtons,
  trackAgentMessageFailed,
  trackAgentMessageHandled,
  trackAgentMessageReceived,
} from "../services/analytics";

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
import { getExistingIdempotencyResponse } from "./idempotency";
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
  const startedAt = Date.now();
  const { platform, sender, content } = message;

  await trackAgentMessageReceived(message);

  try {
    let user = await db.getUser(platform, sender.platformId);
    if (user && message.locale && user.locale !== message.locale) {
      await db.updateUser(platform, sender.platformId, { locale: message.locale });
      user = { ...user, locale: message.locale };
    }

    let response: OutboundResponse;

    if (isCommandContent(content)) {
      response = await handleCommand(message, user);
    } else if (isCallbackContent(content)) {
      response = await handleCallback(message, user);
    } else if (isVoiceContent(content)) {
      response = await handleVoice(message, user);
    } else if (isImageContent(content)) {
      response = await handlePhoto(message, user);
    } else if (isTextContent(content)) {
      response = await handleText(message, user);
    } else {
      response = textResponse(agentMessage(message.locale, "common.unsupportedMessageType"));
    }

    validateOutboundContent(response);
    await trackAgentMessageHandled(message, {
      durationMs: Date.now() - startedAt,
      responseHasButtons: responseHasButtons(response),
    });

    return response;
  } catch (error) {
    await trackAgentMessageFailed(message, error, {
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

/**
 * Validate outbound response content against messaging constraints.
 * Advisory only — logs violations but does not block messages.
 */
function validateOutboundContent(response: OutboundResponse): void {
  const contentCheck = checkMessageContent(response.text);
  if (!contentCheck.clean) {
    log.warn(
      { violations: contentCheck.violations },
      "Outbound message contains prohibited vocabulary"
    );
  }
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
    const rateCheck = checkRateLimit(sender.platformId, "wallet", message.locale);
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
    return textResponse(agentMessage(message.locale, "common.startFirst"));
  }

  switch (command) {
    case "join": {
      const joinRateCheck = checkRateLimit(sender.platformId, "join", message.locale);
      if (joinRateCheck) return joinRateCheck;

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
      const approvalRateCheck = checkRateLimit(sender.platformId, "approval", message.locale);
      if (approvalRateCheck) return approvalRateCheck;

      const result = await handleApprove(message, user, {
        notifyGardener: _context.notifier?.notify.bind(_context.notifier),
      });
      return result.response;
    }

    case "reject": {
      const approvalRateCheck = checkRateLimit(sender.platformId, "approval", message.locale);
      if (approvalRateCheck) return approvalRateCheck;

      const result = await handleReject(message, user, {
        notifyGardener: _context.notifier?.notify.bind(_context.notifier),
      });
      return result.response;
    }

    default:
      return textResponse(agentMessage(message.locale, "common.unknownCommand", { command }));
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
    return textResponse(agentMessage(message.locale, "sessionExpired.start"));
  }

  switch (callbackData) {
    case "confirm_submission": {
      const idempotencyResponse = await getExistingIdempotencyResponse(
        "submit-confirm",
        message,
        "submission"
      );
      if (idempotencyResponse) return idempotencyResponse;

      const session = await db.getSession(platform, sender.platformId);
      if (!session) {
        return textResponse(agentMessage(message.locale, "sessionExpired.submit"));
      }

      const rateCheck = checkRateLimit(sender.platformId, "submission", message.locale);
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
      return textResponse(agentMessage(message.locale, "common.unknownAction"));
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
    return textResponse(agentMessage(message.locale, "common.startFirst"));
  }

  if (!user.currentGarden) {
    return textResponse(agentMessage(message.locale, "common.joinFirst"));
  }

  const rateCheck = checkRateLimit(sender.platformId, "voice", message.locale);
  if (rateCheck) return rateCheck;

  if (!_context.voiceProcessor) {
    return textResponse(agentMessage(message.locale, "voice.unavailable"));
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
    const { category, userMessage } = classifyError(error, message.locale);
    log.error({ err: error, category }, "Voice processing error");
    return textResponse(agentMessage(message.locale, "voice.error", { userMessage }));
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
    return textResponse(agentMessage(message.locale, "common.startFirst"));
  }

  if (!user.currentGarden) {
    return textResponse(agentMessage(message.locale, "common.joinFirst"));
  }

  const rateCheck = checkRateLimit(sender.platformId, "message", message.locale);
  if (rateCheck) return rateCheck;

  try {
    const result = await handleTextSubmission(message, user, { generateId: generateSecureId });

    await applySessionUpdates(platform, sender.platformId, result);
    return result.response;
  } catch (error) {
    const { category, userMessage } = classifyError(error, message.locale);
    log.error({ err: error, category }, "Text processing error");
    return textResponse(`❌ ${userMessage}`);
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
    return textResponse(agentMessage(message.locale, "common.startFirst"));
  }

  if (!user.currentGarden) {
    return textResponse(agentMessage(message.locale, "common.joinFirst"));
  }

  const rateCheck = checkRateLimit(sender.platformId, "message", message.locale);
  if (rateCheck) return rateCheck;

  if (!_context.photoProcessor) {
    return textResponse(agentMessage(message.locale, "photo.unavailable"));
  }

  try {
    const imageContent = content as ImageContent;
    const photoBuffer = await _context.photoProcessor.downloadPhoto(imageContent.imageUrl);

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
        agentMessage(message.locale, "photo.receivedAttached", { count: photoCount }),
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
      agentMessage(message.locale, "photo.newReceived", {
        captionLine: caption ? agentMessage(message.locale, "photo.caption", { caption }) : "",
      }),
      "markdown"
    );
  } catch (error) {
    const { category, userMessage } = classifyError(error, message.locale);
    log.error({ err: error, category }, "Photo processing error");
    return textResponse(agentMessage(message.locale, "photo.error", { userMessage }));
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function checkRateLimit(
  platformId: string,
  type: RateLimitType,
  locale?: string
): OutboundResponse | undefined {
  const result = rateLimiter.check(platformId, type as RateLimitType);
  if (!result.allowed) {
    const waitTime = formatAgentWaitTime(locale, result.resetIn);
    return textResponse(
      agentMessage(locale, "rate.retry", {
        message: agentRateLimitMessage(locale, type),
        waitTime,
      })
    );
  }
  return undefined;
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
export { createGroupCaptureHandler } from "./group-capture";
export type { GroupCaptureHandler } from "./group-capture";
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
