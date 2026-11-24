import type { PublicApiError } from "./funding-types";

/**
 * Automatic recovery for email accounts (Openfort embedded wallets).
 *
 * The app asks the agent for one single-use Shield encryption session before it configures or
 * recovers the person's wallet. The agent answers only a caller holding a live Openfort session,
 * and never returns the project's Shield secret or encryption share. The route is
 * `PUBLIC_AGENT_ROUTES.openfortRecoverySession`.
 */
export type OpenfortRecoveryApiErrorCode =
  | Extract<
      PublicApiError["errorCode"],
      "origin_not_allowed" | "rate_limited" | "provider_unavailable"
    >
  /** No Openfort access token came with the request. */
  | "session_required"
  /** Openfort did not recognise the access token as a live session for this project. */
  | "session_invalid";

export type OpenfortRecoveryApiError = Omit<PublicApiError, "errorCode"> & {
  errorCode: OpenfortRecoveryApiErrorCode;
};

export type OpenfortRecoverySessionResponse =
  | { ok: true; session: string }
  | OpenfortRecoveryApiError;
