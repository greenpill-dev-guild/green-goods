/**
 * Telegram Bot Type Definitions
 *
 * These types are used internally by the bot and should align with
 * the shared package types where applicable.
 */

// Re-export storage types for convenience
export type {
  User,
  Session,
  PendingWork,
  WorkDraftData,
} from "./services/storage";

// Re-export AI types
export type { ParsedTask, ParsedWorkData } from "./services/ai";

/**
 * Work draft prepared for EAS attestation.
 * Matches the WorkDraft interface from @green-goods/shared.
 */
export interface WorkDraft {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
  media: File[] | Buffer[] | string[];
  metadata?: Record<string, unknown>;
}

/**
 * Work approval draft for operator attestations.
 * Matches the WorkApprovalDraft interface from @green-goods/shared.
 */
export interface WorkApprovalDraft {
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback?: string;
}

/**
 * Bot configuration options.
 */
export interface BotConfig {
  /** Telegram Bot API token */
  token: string;
  /** Path to SQLite database file */
  dbPath?: string;
  /** Default chain ID for blockchain operations */
  defaultChainId?: number;
  /** Enable verbose logging */
  debug?: boolean;
}

/**
 * Supported conversation steps/states.
 */
export type ConversationStep =
  | "idle"
  | "joining_garden"
  | "submitting_work"
  | "approving_work"
  | "editing_work";

/**
 * Telegram user roles.
 */
export type UserRole = "gardener" | "operator" | "admin";

/**
 * Blockchain transaction result.
 */
export interface TransactionResult {
  hash: `0x${string}`;
  chainId: number;
  success: boolean;
  error?: string;
}

/**
 * Voice processing result.
 */
export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
}
