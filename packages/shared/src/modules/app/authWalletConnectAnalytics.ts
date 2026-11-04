import { ANALYTICS_EVENTS, createTracker } from "./analytics-events";
import { track, type TrackOptions } from "./posthog";

/** The wallets the chooser offers; anything else it shows is "other". */
export type AuthWalletConnectWallet = "metamask" | "rabby" | "rainbow" | "coinbase" | "other";

/** How the chooser reached the wallet; "mobile" hands the request to a wallet app on the phone. */
export type AuthWalletConnectPlatform =
  | "mobile"
  | "desktop"
  | "browser"
  | "web"
  | "qrcode"
  | "unsupported";

/**
 * - timeout: a phone wallet was chosen and its app never came to the front
 * - connect_error: the chooser reported a failed connection
 * - rejected: the member declined the request in the wallet
 * - cancelled: the chooser closed before the wallet answered
 */
export type AuthWalletConnectFailureReason = "timeout" | "connect_error" | "rejected" | "cancelled";

type AuthWalletConnectEvent = {
  wallet?: AuthWalletConnectWallet;
  platform?: AuthWalletConnectPlatform;
  durationMs?: number;
};

// Wallet sign-in health, recorded without the member or the wallet address behind it.
const WALLET_CONNECT_TRACK_OPTIONS: TrackOptions = {
  anonymizeIdentity: true,
  includeSessionId: false,
};

export const trackAuthWalletConnectStarted = () =>
  track(ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_STARTED, {}, WALLET_CONNECT_TRACK_OPTIONS);

export const trackAuthWalletConnectSuccess = createTracker<
  AuthWalletConnectEvent & {
    /** A wallet timed out earlier in this sign-in, as when the wallet app opened only on retry. */
    timedOut?: boolean;
  }
>(ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_SUCCESS, WALLET_CONNECT_TRACK_OPTIONS);

export const trackAuthWalletConnectFailed = createTracker<
  AuthWalletConnectEvent & {
    reason: AuthWalletConnectFailureReason;
    /** The page went to the background after the choice, as it does when a wallet app opens. */
    backgrounded?: boolean;
  }
>(ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_FAILED, WALLET_CONNECT_TRACK_OPTIONS);
