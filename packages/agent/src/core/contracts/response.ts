/**
 * Platform-agnostic response contracts for the agent.
 * These types define the common interface for responses across all platforms.
 */

import type { Platform } from "./message";

/**
 * Outbound response to send to a user.
 */
export interface OutboundResponse {
  /** Text content of the response */
  text: string;
  /** Parse mode for text formatting */
  parseMode?: "markdown" | "html";
  /** Interactive buttons */
  buttons?: ResponseButton[];
  /** Attachments (images, files) */
  attachments?: ResponseAttachment[];
}

/**
 * Interactive button in a response
 */
export interface ResponseButton {
  /** Button label text */
  label: string;
  /** Callback data sent when button is pressed */
  callbackData: string;
  /** Optional URL to open (if set, callbackData is ignored) */
  url?: string;
}

/**
 * Attachment in a response
 */
export interface ResponseAttachment {
  type: "image" | "file";
  url: string;
  caption?: string;
}

/**
 * Result from a handler function
 */
export interface HandlerResult {
  /** Response to send to user */
  response: OutboundResponse;
  /** Session updates to apply */
  updateSession?: SessionUpdate;
  /** Whether to clear the current session */
  clearSession?: boolean;
}

/**
 * Session state for a user
 */
export interface Session {
  /** Platform identifier */
  platform: Platform;
  /** Platform-specific user ID */
  platformId: string;
  /** Current conversation step */
  step: SessionStep;
  /** Draft data being built */
  draft?: unknown;
  /** Last updated timestamp */
  updatedAt: number;
}

export type SessionStep =
  | "idle"
  | "joining_garden"
  | "submitting_work"
  | "confirming_work"
  | "approving_work"
  | "rejecting_work";

/**
 * Partial session update
 */
export type SessionUpdate = Partial<Omit<Session, "platform" | "platformId">>;

/**
 * Create an empty response (no-op)
 */
export function emptyResponse(): OutboundResponse {
  return { text: "" };
}

/**
 * Create a simple text response
 */
export function textResponse(text: string, parseMode?: "markdown" | "html"): OutboundResponse {
  return { text, parseMode };
}

/**
 * Create a response with inline buttons
 */
export function buttonResponse(
  text: string,
  buttons: ResponseButton[],
  parseMode?: "markdown" | "html"
): OutboundResponse {
  return { text, buttons, parseMode };
}
