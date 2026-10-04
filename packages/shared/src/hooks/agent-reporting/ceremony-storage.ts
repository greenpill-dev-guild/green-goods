import type { OutcomeRequest } from "../../modules/agent-reporting/api-contract";
import { CeremonyError } from "../../modules/agent-reporting/ceremony-client";

/**
 * What one tab remembers about its own ceremony, in session storage only: which access session it
 * opened, and an outcome it could not deliver yet. Neither is a credential; the session cookie is
 * HttpOnly and the CSRF token lives in memory. Storage may be unavailable, so every access is
 * best effort and the page still works without it.
 */
export interface StoredCeremony {
  accessId?: string;
  /**
   * The account the person let go of on this page's account step. When a different account signs
   * in, the app remounts every screen (`useIdentityChangeReset`); this brings the page back to
   * its account step instead of its start. The same account coming back remounts nothing, and a
   * reload finds no account connected yet, so in neither case does the page continue by itself.
   */
  changingAccountFrom?: string;
  pendingReport?: { operationId: string; request: OutcomeRequest };
  pendingGrant?: {
    grantId: string;
    version: number;
    policyDigest: `0x${string}`;
    enableReference: `0x${string}`;
  };
  /** Public outcome only; owner enable signatures are never persisted or sent to the Agent. */
  pendingGrantActivation?: {
    grantId: string;
    policyDigest: `0x${string}`;
    request: OutcomeRequest;
  };
}

const key = (requestId: string) => `gg-agent-reporting:${requestId}`;

export function readCeremony(requestId: string): StoredCeremony | null {
  try {
    const raw = window.sessionStorage.getItem(key(requestId));
    return raw ? (JSON.parse(raw) as StoredCeremony) : null;
  } catch {
    return null;
  }
}

export function writeCeremony(requestId: string, value: StoredCeremony): void {
  try {
    window.sessionStorage.setItem(key(requestId), JSON.stringify(value));
  } catch {
    // Without storage a refresh starts over; the Agent's watchdog still reconciles the send.
  }
}

export function clearCeremony(requestId: string): void {
  try {
    window.sessionStorage.removeItem(key(requestId));
  } catch {
    // Nothing stored.
  }
}

/** Failures the ceremony pages explain, in the person's terms rather than API codes. */
export type CeremonyFailure =
  | "expired"
  | "not_yours"
  | "changed"
  | "paused"
  | "rate_limited"
  | "unsupported"
  | "offline"
  | "declined"
  | "wrong_account"
  | "envelope_mismatch"
  | "outcome_unknown"
  | "unknown";

export function ceremonyFailure(error: unknown): CeremonyFailure {
  if (!(error instanceof CeremonyError)) return "unknown";
  switch (error.code) {
    case "access_required":
    case "unavailable":
      return "expired";
    case "forbidden":
      return "not_yours";
    case "stale_revision":
    case "conflict":
      return "changed";
    case "paused":
      return "paused";
    case "rate_limited":
      return "rate_limited";
    case "unsupported_scope":
      return "unsupported";
    case "network":
    case "dependency_unavailable":
      return "offline";
    case "outcome_unknown":
      return "outcome_unknown";
    default:
      return "unknown";
  }
}
