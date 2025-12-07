/**
 * Orchestrator - Routes messages to appropriate handlers
 *
 * The orchestrator is the central hub that:
 * - Receives platform-agnostic messages
 * - Applies rate limiting
 * - Routes to appropriate handlers
 * - Returns platform-agnostic responses
 */

import {
  type InboundMessage,
  type CommandContent,
  type VoiceContent,
  type CallbackContent,
  isCommandContent,
  isTextContent,
  isVoiceContent,
  isCallbackContent,
} from "./contracts/message";
import { type OutboundResponse, textResponse } from "./contracts/response";
import type { StoragePort, User } from "../ports/storage";
import type { AIPort } from "../ports/ai";
import type { BlockchainPort } from "../ports/blockchain";

// Import handlers
import { handleStart } from "./handlers/start";
import { handleJoin } from "./handlers/join";
import { handleStatus } from "./handlers/status";
import { handleHelp } from "./handlers/help";
import { handlePending } from "./handlers/pending";
import {
  handleTextSubmission,
  handleVoiceSubmission,
  handleConfirmSubmission,
  handleCancelSubmission,
} from "./handlers/submit";
import { handleApprove } from "./handlers/approve";
import { handleReject } from "./handlers/reject";
import { formatWaitTime } from "./handlers/utils";

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  message?: string;
  resetIn?: number;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  check(platformId: string, type: string): RateLimitResult;
  peek(platformId: string, type: string): { remaining: number; limit: number };
}

/**
 * Crypto service interface
 */
export interface CryptoService {
  generateSecurePrivateKey(): `0x${string}`;
  generateSecureId(): string;
  isValidAddress(address: string): boolean;
}

/**
 * Voice processor for downloading and transcribing audio
 */
export interface VoiceProcessor {
  downloadAndTranscribe(audioUrl: string): Promise<string>;
}

/**
 * Notifier for sending messages to users
 */
export interface Notifier {
  notify(platform: string, platformId: string, message: string): Promise<void>;
}

/**
 * Orchestrator dependencies
 */
export interface OrchestratorDeps {
  storage: StoragePort;
  ai: AIPort;
  blockchain: BlockchainPort;
  rateLimiter: RateLimiter;
  crypto: CryptoService;
  voiceProcessor?: VoiceProcessor;
  notifier?: Notifier;
}

/**
 * Message orchestrator
 */
export class Orchestrator {
  private deps: OrchestratorDeps;

  constructor(deps: OrchestratorDeps) {
    this.deps = deps;
  }

  /**
   * Apply session updates from a handler result
   */
  private async applySessionUpdates(
    platform: string,
    platformId: string,
    result: { updateSession?: { step?: string; draft?: unknown }; clearSession?: boolean }
  ): Promise<void> {
    if (result.clearSession) {
      await this.deps.storage.clearSession(
        platform as "telegram" | "discord" | "whatsapp",
        platformId
      );
    } else if (result.updateSession) {
      await this.deps.storage.setSession({
        platform: platform as "telegram" | "discord" | "whatsapp",
        platformId,
        step: (result.updateSession.step || "idle") as
          | "idle"
          | "joining_garden"
          | "submitting_work"
          | "confirming_work"
          | "approving_work"
          | "rejecting_work",
        draft: result.updateSession.draft,
        updatedAt: Date.now(),
      });
    }
  }

  /**
   * Handle an inbound message and return a response
   */
  async handle(message: InboundMessage): Promise<OutboundResponse> {
    const { platform, sender, content } = message;
    const { storage } = this.deps;

    // Get user (may be undefined for /start and /help)
    const user = await storage.getUser(platform, sender.platformId);

    // Route based on content type
    if (isCommandContent(content)) {
      return this.handleCommand(message, user);
    }

    if (isCallbackContent(content)) {
      return this.handleCallback(message, user);
    }

    if (isVoiceContent(content)) {
      return this.handleVoice(message, user);
    }

    if (isTextContent(content)) {
      return this.handleText(message, user);
    }

    return textResponse("❌ Unsupported message type.");
  }

  /**
   * Handle command messages
   */
  private async handleCommand(
    message: InboundMessage,
    user: User | undefined
  ): Promise<OutboundResponse> {
    const { sender, content } = message;
    const command = (content as CommandContent).name.toLowerCase();

    // Commands that don't require user
    if (command === "start") {
      const rateCheck = this.checkRateLimit(sender.platformId, "wallet");
      if (rateCheck) return rateCheck;

      const result = await handleStart(message, {
        storage: this.deps.storage,
        generatePrivateKey: this.deps.crypto.generateSecurePrivateKey,
      });
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

    const rateCheck = this.checkRateLimit(sender.platformId, "command");
    if (rateCheck) return rateCheck;

    switch (command) {
      case "join": {
        const result = await handleJoin(message, user, {
          storage: this.deps.storage,
          blockchain: this.deps.blockchain,
          isValidAddress: this.deps.crypto.isValidAddress,
        });
        return result.response;
      }

      case "status": {
        const result = await handleStatus(message, user, {
          storage: this.deps.storage,
          getRateLimitStats: (platformId, type) => this.deps.rateLimiter.peek(platformId, type),
        });
        return result.response;
      }

      case "pending": {
        const result = await handlePending(message, user, {
          storage: this.deps.storage,
        });
        return result.response;
      }

      case "approve": {
        const rateCheck = this.checkRateLimit(sender.platformId, "approval");
        if (rateCheck) return rateCheck;

        const result = await handleApprove(message, user, {
          storage: this.deps.storage,
          blockchain: this.deps.blockchain,
          notifyGardener: this.deps.notifier?.notify.bind(this.deps.notifier),
        });
        return result.response;
      }

      case "reject": {
        const rateCheck = this.checkRateLimit(sender.platformId, "approval");
        if (rateCheck) return rateCheck;

        const result = await handleReject(message, user, {
          storage: this.deps.storage,
          blockchain: this.deps.blockchain,
          notifyGardener: this.deps.notifier?.notify.bind(this.deps.notifier),
        });
        return result.response;
      }

      default:
        return textResponse(`Unknown command: /${command}`);
    }
  }

  /**
   * Handle callback (button press) messages
   */
  private async handleCallback(
    message: InboundMessage,
    user: User | undefined
  ): Promise<OutboundResponse> {
    const { platform, sender, content } = message;
    const callbackData = (content as CallbackContent).data;

    if (!user) {
      return textResponse("Session expired. Please start again with /start");
    }

    const session = await this.deps.storage.getSession(platform, sender.platformId);

    switch (callbackData) {
      case "confirm_submission": {
        if (!session) {
          return textResponse("Session expired. Please submit your work again.");
        }

        const rateCheck = this.checkRateLimit(sender.platformId, "submission");
        if (rateCheck) return rateCheck;

        const result = await handleConfirmSubmission(message, user, session, {
          storage: this.deps.storage,
          ai: this.deps.ai,
          generateId: this.deps.crypto.generateSecureId,
          notifyOperator: this.deps.notifier
            ? async (operatorId, msg) => {
                const operator = await this.deps.storage.getOperatorForGarden(user.currentGarden!);
                if (operator) {
                  await this.deps.notifier!.notify(operator.platform, operator.platformId, msg);
                }
              }
            : undefined,
        });

        // Apply session updates
        await this.applySessionUpdates(platform, sender.platformId, result);

        return result.response;
      }

      case "cancel_submission": {
        const result = await handleCancelSubmission(message, {
          storage: this.deps.storage,
          ai: this.deps.ai,
          generateId: this.deps.crypto.generateSecureId,
        });
        return result.response;
      }

      default:
        return textResponse("Unknown action.");
    }
  }

  /**
   * Handle voice messages
   */
  private async handleVoice(
    message: InboundMessage,
    user: User | undefined
  ): Promise<OutboundResponse> {
    const { sender, content } = message;

    if (!user) {
      return textResponse("Please run /start first to create your wallet.");
    }

    if (!user.currentGarden) {
      return textResponse("Please join a garden first with `/join <GardenAddress>`");
    }

    const rateCheck = this.checkRateLimit(sender.platformId, "voice");
    if (rateCheck) return rateCheck;

    if (!this.deps.voiceProcessor) {
      return textResponse("Voice processing is not available. Please send a text message instead.");
    }

    try {
      const voiceContent = content as VoiceContent;
      const transcribedText = await this.deps.voiceProcessor.downloadAndTranscribe(
        voiceContent.audioUrl
      );

      const result = await handleVoiceSubmission(message, user, transcribedText, {
        storage: this.deps.storage,
        ai: this.deps.ai,
        generateId: this.deps.crypto.generateSecureId,
      });

      // Apply session updates
      await this.applySessionUpdates(message.platform, sender.platformId, result);

      return result.response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Voice processing error:", error);
      return textResponse(
        `❌ Sorry, I couldn't process that audio.\n\n` +
          `Error: ${errorMessage}\n\n` +
          `Try sending a text message instead.`
      );
    }
  }

  /**
   * Handle text messages (non-command)
   */
  private async handleText(
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

    const rateCheck = this.checkRateLimit(sender.platformId, "message");
    if (rateCheck) return rateCheck;

    try {
      const result = await handleTextSubmission(message, user, {
        storage: this.deps.storage,
        ai: this.deps.ai,
        generateId: this.deps.crypto.generateSecureId,
      });

      // Apply session updates
      await this.applySessionUpdates(platform, sender.platformId, result);

      return result.response;
    } catch (error) {
      console.error("Text processing error:", error);
      return textResponse("❌ Sorry, I couldn't process that message. Please try again.");
    }
  }

  /**
   * Check rate limit and return error response if limited
   */
  private checkRateLimit(platformId: string, type: string): OutboundResponse | undefined {
    const result = this.deps.rateLimiter.check(platformId, type);
    if (!result.allowed) {
      const waitTime = formatWaitTime(result.resetIn || 0);
      return textResponse(`⏳ ${result.message}\n\nPlease wait ${waitTime} before trying again.`);
    }
    return undefined;
  }
}
