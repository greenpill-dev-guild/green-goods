import type { Database } from "bun:sqlite";
import { randomBytes, randomUUID } from "node:crypto";
import type { ReportingKeyring } from "./keyring";

/** Time and identity sources are injected so tests replay exact schedules and identifiers. */
export interface ReportingClock {
  now(): number;
}

export interface ReportingIds {
  id(): string;
  /** URL-safe secret with at least `bytes` of entropy. */
  token(bytes?: number): string;
  /** Human-typable numeric code. */
  code(digits: number): string;
}

export const systemClock: ReportingClock = { now: () => Date.now() };

export const randomIds: ReportingIds = {
  id: () => randomUUID(),
  token: (bytes = 24) => randomBytes(bytes).toString("base64url"),
  code: (digits) => {
    const value = randomBytes(6).readUIntBE(0, 6) % 10 ** digits;
    return value.toString().padStart(digits, "0");
  },
};

export interface EnabledGarden {
  key: string;
  chainId: number;
  address: `0x${string}`;
  label: string;
}

/** Accepted defaults from technical brief sections 9 and 10; deployments may only shorten them. */
export interface ReportingSettings {
  chainId: number;
  noticeVersion: string;
  supportContact: string;
  browserOrigin: string;
  gardens: readonly EnabledGarden[];
  preConsentRetentionMs: number;
  inactiveDraftRetentionMs: number;
  linkChallengeTtlMs: number;
  browserSessionTtlMs: number;
  recoveryTtlMs: number;
  conversationLeaseMs: number;
  maxEventAttempts: number;
  maxOutboxAttempts: number;
  choicePageSize: number;
}

export const DEFAULT_REPORTING_SETTINGS: Omit<
  ReportingSettings,
  "chainId" | "browserOrigin" | "gardens"
> = {
  noticeVersion: "2026-09-26",
  supportContact: "afo@wefa.world",
  preConsentRetentionMs: 24 * 60 * 60 * 1000,
  inactiveDraftRetentionMs: 7 * 24 * 60 * 60 * 1000,
  linkChallengeTtlMs: 10 * 60 * 1000,
  browserSessionTtlMs: 15 * 60 * 1000,
  recoveryTtlMs: 10 * 60 * 1000,
  conversationLeaseMs: 30 * 1000,
  maxEventAttempts: 5,
  maxOutboxAttempts: 6,
  choicePageSize: 10,
};

/** The durable core every reporting component shares. */
export interface ReportingCore {
  db: Database;
  keyring: ReportingKeyring;
  clock: ReportingClock;
  ids: ReportingIds;
  settings: ReportingSettings;
}
