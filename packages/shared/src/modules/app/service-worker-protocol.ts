/**
 * The contract between the page and its service worker: the messages the
 * page posts, the replies the worker sends, and the cache names both sides
 * read. The worker itself is built from `packages/client/src/sw`; the page
 * side lives in this package so every app talks to the worker the same way.
 *
 * @module modules/app/service-worker-protocol
 */

/** Messages the page posts to the worker. */
export const SW_MESSAGE = {
  /** Download the non-critical shell tail; the reply port hears the outcome. */
  PREPARE_PWA_TAIL: "PREPARE_PWA_TAIL",
  PAUSE_PWA_TAIL: "PAUSE_PWA_TAIL",
  /** Sent to the active worker so it settles background work before a waiting one takes over. */
  PREPARE_TO_ACTIVATE_UPDATE: "PREPARE_TO_ACTIVATE_UPDATE",
  RESUME_BACKGROUND_WORK: "RESUME_BACKGROUND_WORK",
  OFFLINE_CONTENT_CAPABILITIES: "OFFLINE_CONTENT_CAPABILITIES",
  MEDIA_POLICY: "MEDIA_POLICY",
  MEDIA_STATS: "MEDIA_STATS",
  MEDIA_SWEEP: "MEDIA_SWEEP",
  REGISTER_SYNC: "REGISTER_SYNC",
  SKIP_WAITING: "SKIP_WAITING",
  ENS_REGISTRATION_COMPLETE: "ENS_REGISTRATION_COMPLETE",
} as const;

export type ServiceWorkerMessageType = (typeof SW_MESSAGE)[keyof typeof SW_MESSAGE];

/** Messages the worker sends back, on a reply port or to every open window. */
export const SW_REPLY = {
  QUIET_ACK: "GG_QUIET_ACK",
  UPDATE_ACK: "GG_UPDATE_ACK",
  BACKGROUND_SYNC: "BACKGROUND_SYNC",
} as const;

export interface MediaPolicyMessage {
  type: typeof SW_MESSAGE.MEDIA_POLICY | typeof SW_MESSAGE.MEDIA_SWEEP;
  budgetBytes: number;
  keep: string[];
}

export interface EnsRegistrationCompleteMessage {
  type: typeof SW_MESSAGE.ENS_REGISTRATION_COMPLETE;
  slug: string;
}

export type ServiceWorkerMessage =
  | {
      type: Exclude<
        ServiceWorkerMessageType,
        MediaPolicyMessage["type"] | EnsRegistrationCompleteMessage["type"]
      >;
    }
  | MediaPolicyMessage
  | EnsRegistrationCompleteMessage;

export type TailStatus = "ready" | "unavailable" | "paused" | "blocked" | "failed";

export interface MediaStatsReply {
  bytes: number;
  count: number;
  failed?: boolean;
}

export interface QuietAckReply {
  type: typeof SW_REPLY.QUIET_ACK;
  status: "quiet" | "failed";
}

export type UpdateAckStatus = "received" | "requested" | "rejected";

export interface UpdateAckReply {
  type: typeof SW_REPLY.UPDATE_ACK;
  status: UpdateAckStatus;
}

export interface BackgroundSyncNotice {
  type: typeof SW_REPLY.BACKGROUND_SYNC;
  payload: { tag: string; fallback?: boolean; timestamp: number };
}

export interface OfflineContentCapabilitiesReply {
  offlineContentVersion: number;
}

/** Cache Storage names the worker owns and the page reads. */
export const SW_CACHES = {
  /** The sized photo cache; `<img>` requests and offline downloads share it. */
  MEDIA: "ipfs-cache",
  MEDIA_POLICY: "gg-media-policy-v1",
  /** Photos an older worker prepared; read through until replaced. */
  LEGACY_PREPARED_MEDIA: "gg-prepared-media-v1",
  SHELL_PREFIX: "gg-pwa-shell-",
  SHELL_METADATA: "gg-pwa-metadata-v2",
  LEGACY_SHELL_METADATA: "gg-pwa-shell-meta",
  SHARE_INBOX: "gg-share-inbox-v1",
  JS_RUNTIME: "gg-js-runtime",
  IMAGES: "image-cache",
} as const;

/** Runtime caches retired workers left behind; safe to delete from either side. */
export const OBSOLETE_RUNTIME_CACHES = ["js-cache", "indexer-cache", "graphql-cache"] as const;

/** Raised when the worker learns to keep something new; the page compares before relying on it. */
export const OFFLINE_CONTENT_VERSION = 3;
export const GREEN_GOODS_SYNC_TAG = "green-goods-sync";
export const CONNECTIVITY_CHECK_PATH = "/connectivity-check.txt";
export const SHARE_TARGET_PATH = "/home/share";
export const SHARE_ENVELOPE_PREFIX = "/__gg_share_envelope__/";
export const SHARE_FILE_PREFIX = "/__gg_share_file__/";
/** Gateways whose photos the worker keeps offline. */
export const IPFS_GATEWAY_HOSTS = [
  "greengoods.mypinata.cloud",
  "gateway.pinata.cloud",
  "ipfs.io",
] as const;

/** Whether a URL is gateway media the worker keeps in its photo cache. */
export function isKeptMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (IPFS_GATEWAY_HOSTS as readonly string[]).includes(parsed.hostname) &&
      parsed.pathname.startsWith("/ipfs/")
    );
  } catch {
    return false;
  }
}
