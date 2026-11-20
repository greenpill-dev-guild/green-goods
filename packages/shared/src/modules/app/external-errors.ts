/**
 * Errors that come from someone else's code (PRD-1560)
 *
 * Two outside sources reach us as if they were our own errors: WalletConnect's relay socket, and
 * the toolbar Vercel injects into the beta deployment (`vercel.live`), which throws on older
 * browsers. Both stay reported, tagged as external so a dashboard or alert can set them apart.
 *
 * A relay connect that failed, stalled or was interrupted is retried by WalletConnect and usually
 * recovers, so when nothing of ours handled it, it drops to a warning. Everything else keeps its
 * level: the relay refusing this site (code 3000, an origin or project key it does not accept)
 * blocks wallet sign-in outright, and a sign-in or signature that failed is reported by our own
 * code, handled, whatever the relay said.
 *
 * @module modules/app/external-errors
 */

export type ExternalErrorSource = "walletconnect" | "vercel_toolbar";

export interface ExternalErrorClassification {
  source: ExternalErrorSource;
  /** A relay reconnect WalletConnect retries on its own. */
  recoverable: boolean;
}

export interface ExternalErrorEvidence {
  /** Error messages, the outermost first. */
  messages: readonly unknown[];
  /** Script locations from the stack frames, or the file an error event names. */
  locations: readonly unknown[];
}

// The beta toolbar's script: https://vercel.live/_next-live/feedback/feedback.js
const VERCEL_TOOLBAR_SCRIPT = /(?:^|\/\/)vercel\.live\/|\/_next-live\//;

// WalletConnect's own wording, from @walletconnect/jsonrpc-ws-connection,
// @walletconnect/jsonrpc-provider and @walletconnect/core.
const WALLETCONNECT_RELAY =
  /relay\.walletconnect\.(?:org|com)|WebSocket connection closed abnormally with code: \d+|Connection interrupted while trying to subscribe/i;
const WALLETCONNECT_RECONNECT =
  /WebSocket connection failed for host|Socket stalled when trying to connect|Connection interrupted while trying to subscribe/i;
// The relay refusing this site's origin or project key: nothing will reconnect it.
const WALLETCONNECT_REFUSED = /WebSocket connection closed abnormally with code: 3000/i;

function strings(values: readonly unknown[]): string[] {
  return values.filter((value): value is string => typeof value === "string");
}

/** Which outside source raised an error, or null when it is ours. */
export function classifyExternalError(
  evidence: ExternalErrorEvidence
): ExternalErrorClassification | null {
  if (strings(evidence.locations).some((location) => VERCEL_TOOLBAR_SCRIPT.test(location))) {
    return { source: "vercel_toolbar", recoverable: false };
  }
  const messages = strings(evidence.messages);
  if (messages.some((message) => WALLETCONNECT_RELAY.test(message))) {
    // A refusal anywhere in the chain outranks reconnect evidence beside it.
    const refused = messages.some((message) => WALLETCONNECT_REFUSED.test(message));
    return {
      source: "walletconnect",
      recoverable: !refused && messages.some((message) => WALLETCONNECT_RECONNECT.test(message)),
    };
  }
  return null;
}

/** The properties an external error carries in PostHog and the tags it carries in Sentry. */
export function externalErrorTags(classification: ExternalErrorClassification): {
  error_origin: "external";
  external_source: ExternalErrorSource;
} {
  return { error_origin: "external", external_source: classification.source };
}
