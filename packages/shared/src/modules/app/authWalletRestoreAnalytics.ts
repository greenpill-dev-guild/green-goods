import { track } from "./posthog";

export interface AuthWalletRestoreEvent {
  authMode: "wallet" | "embedded";
  /** `reconnected`: a wallet kept signed in after a timeout answered again. */
  outcome: "started" | "delayed" | "success" | "failed" | "reconnected";
  reason?: "timeout";
  durationMs?: number;
  /** On a timeout, whether the remembered wallet stayed signed in. */
  sessionKept?: boolean;
}

/** Records aggregate restore health without the current user or wallet identity. */
export function trackAuthWalletRestore(event: AuthWalletRestoreEvent): void {
  track(
    "auth_wallet_restore",
    {
      auth_mode: event.authMode,
      outcome: event.outcome,
      reason: event.reason,
      duration_ms: event.durationMs,
      session_kept: event.sessionKept,
    },
    { anonymizeIdentity: true, includeSessionId: false }
  );
}
