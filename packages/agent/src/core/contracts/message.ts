/**
 * Platform-agnostic message contracts for the agent.
 * These types define the common interface for messages across all platforms.
 */

export type Platform = "telegram" | "discord" | "whatsapp";

/**
 * Inbound message from any platform, normalized to a common format.
 */
export interface InboundMessage {
  /** Unique message identifier */
  id: string;
  /** Source platform */
  platform: Platform;
  /** Sender information */
  sender: {
    /** Platform-specific user ID */
    platformId: string;
    /** Display name (if available) */
    displayName?: string;
  };
  /** Message content */
  content: MessageContent;
  /** User locale (e.g., 'en', 'es') */
  locale?: string;
  /** Message timestamp (Unix ms) */
  timestamp: number;
}

/**
 * Message content variants
 */
export type MessageContent =
  | TextContent
  | CommandContent
  | VoiceContent
  | CallbackContent
  | ImageContent;

export interface TextContent {
  type: "text";
  text: string;
}

export interface CommandContent {
  type: "command";
  name: string;
  args: string[];
}

export interface VoiceContent {
  type: "voice";
  audioUrl: string;
  mimeType: string;
  duration?: number;
}

export interface CallbackContent {
  type: "callback";
  data: string;
  /** Original message ID that triggered the callback */
  messageId?: string;
}

export interface ImageContent {
  type: "image";
  imageUrl: string;
  mimeType: string;
  caption?: string;
}

/**
 * Type guard for text content
 */
export function isTextContent(content: MessageContent): content is TextContent {
  return content.type === "text";
}

/**
 * Type guard for command content
 */
export function isCommandContent(
  content: MessageContent
): content is CommandContent {
  return content.type === "command";
}

/**
 * Type guard for voice content
 */
export function isVoiceContent(
  content: MessageContent
): content is VoiceContent {
  return content.type === "voice";
}

/**
 * Type guard for callback content
 */
export function isCallbackContent(
  content: MessageContent
): content is CallbackContent {
  return content.type === "callback";
}

/**
 * Type guard for image content
 */
export function isImageContent(
  content: MessageContent
): content is ImageContent {
  return content.type === "image";
}

