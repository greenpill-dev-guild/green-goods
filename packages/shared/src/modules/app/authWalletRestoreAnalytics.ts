import { track } from "./posthog";

export interface AuthWalletRestoreEvent {
  authMode: "wallet" | "embedded";
  outcome: "started" | "delayed" | "success" | "failed";
  reason?: "timeout";
  durationMs?: number;
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
    },
    { anonymizeIdentity: true, includeSessionId: false }
  );
}
