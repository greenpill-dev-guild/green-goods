/**
 * Agent Types
 *
 * Agent-specific types for bot functionality.
 * Domain types should be imported from @green-goods/shared when possible.
 *
 * @example
 * ```typescript
 * import type { Garden, Work, WorkJobPayload } from '@green-goods/shared';
 * ```
 */

import type { Hex } from "viem";

// ============================================================================
// PLATFORMS
// ============================================================================

export type Platform = "telegram" | "discord" | "whatsapp" | "sms";

// ============================================================================
// MESSAGES (Inbound)
// ============================================================================

export interface InboundMessage {
  id: string;
  platform: Platform;
  sender: {
    platformId: string;
    displayName?: string;
  };
  content: MessageContent;
  locale?: string;
  timestamp: number;
}

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
  messageId?: string;
}

export interface ImageContent {
  type: "image";
  imageUrl: string;
  mimeType: string;
  caption?: string;
}

// Type guards
export const isTextContent = (c: MessageContent): c is TextContent => c.type === "text";
export const isCommandContent = (c: MessageContent): c is CommandContent => c.type === "command";
export const isVoiceContent = (c: MessageContent): c is VoiceContent => c.type === "voice";
export const isCallbackContent = (c: MessageContent): c is CallbackContent => c.type === "callback";
export const isImageContent = (c: MessageContent): c is ImageContent => c.type === "image";

// ============================================================================
// RESPONSES (Outbound)
// ============================================================================

export interface OutboundResponse {
  text: string;
  parseMode?: "markdown" | "html";
  buttons?: ResponseButton[];
  attachments?: ResponseAttachment[];
}

export interface ResponseButton {
  label: string;
  callbackData: string;
  url?: string;
}

export interface ResponseAttachment {
  type: "image" | "file";
  url: string;
  caption?: string;
}

// Response helpers
export const textResponse = (text: string, parseMode?: "markdown" | "html"): OutboundResponse => ({
  text,
  parseMode,
});

export const buttonResponse = (
  text: string,
  buttons: ResponseButton[],
  parseMode?: "markdown" | "html"
): OutboundResponse => ({ text, buttons, parseMode });

// ============================================================================
// HANDLER RESULT
// ============================================================================

export interface HandlerResult {
  response: OutboundResponse;
  updateSession?: SessionUpdate;
  clearSession?: boolean;
}

// ============================================================================
// USER & SESSION
// ============================================================================

export interface User {
  platform: Platform;
  platformId: string;
  privateKey: string;
  address: string;
  currentGarden?: string;
  role?: "gardener" | "operator";
  createdAt: number;
}

export interface CreateUserInput {
  platform: Platform;
  platformId: string;
  privateKey: string;
  address: string;
  currentGarden?: string;
  role?: "gardener" | "operator";
}

export interface Session {
  platform: Platform;
  platformId: string;
  step: SessionStep;
  draft?: unknown;
  updatedAt: number;
}

export type SessionStep =
  | "idle"
  | "joining_garden"
  | "submitting_work"
  | "confirming_work"
  | "approving_work"
  | "rejecting_work"
  | "awaiting_photo"
  | "awaiting_details";

export type SessionUpdate = Partial<Omit<Session, "platform" | "platformId">>;

// ============================================================================
// PENDING WORK
// ============================================================================

export interface PendingWork {
  id: string;
  actionUID: number;
  gardenerAddress: string;
  gardenerPlatform: Platform;
  gardenerPlatformId: string;
  gardenAddress: string;
  data: WorkDraftData;
  createdAt: number;
}

export interface WorkDraftData {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
  media: string[];
}

// ============================================================================
// BLOCKCHAIN
// ============================================================================

export interface GardenInfo {
  exists: boolean;
  name?: string;
  address: string;
}

export interface SubmitWorkParams {
  privateKey: Hex;
  gardenAddress: string;
  actionUID: number;
  actionTitle: string;
  workData: {
    title: string;
    plantSelection: string[];
    plantCount: number;
    feedback: string;
  };
  media?: Buffer[];
}

export interface SubmitApprovalParams {
  privateKey: Hex;
  gardenerAddress: string;
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback?: string;
}

export interface VerificationResult {
  verified: boolean;
  reason?: string;
  cachedAt?: number;
}

// ============================================================================
// AI / NLU
// ============================================================================

export interface ParsedTask {
  type: "planting" | "weeding" | "maintenance" | "harvesting" | "other";
  species: string;
  count?: number;
  amount?: number;
  unit?: string;
}

export interface ParsedWorkData {
  tasks: ParsedTask[];
  notes: string;
  date: string;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  limit: number;
  message?: string;
}
