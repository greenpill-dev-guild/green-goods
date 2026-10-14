import type { Address } from "../../types/domain";
import type { PublicApiError } from "../index";

export const SAVED_OFFERS_ROUTES = {
  challenge: "/public/saved-offers/session/challenge",
  session: "/public/saved-offers/session",
  collection: "/public/saved-offers",
} as const;

export const SAVED_OFFER_SCHEMA_VERSION = 1 as const;
export const SAVED_OFFER_MAX_BYTES = 32 * 1024;
export const SAVED_OFFER_MAX_REQUIREMENTS = 40;
export const SAVED_OFFER_MAX_SERIES_LINKS = 32;
export const SAVED_OFFER_MAX_RECORDS_PER_OWNER = 100;
export const SAVED_OFFER_MAX_TOMBSTONES_PER_OWNER = 100;

export type SavedOfferPersistenceState =
  | "LOCAL_DRAFT"
  | "SAVING_REMOTE"
  | "SAVED_REMOTE"
  | "SAVE_FAILED"
  | "OFFLINE_LOCAL"
  | "VERSION_CONFLICT";

export type SavedOfferPayloadV1 = {
  schemaVersion: 1;
  savedOfferId: string;
  title: string;
  description: string;
  commitmentKind: "DomainImpact" | "SupportService";
  unitLabel: string;
  targetUnits: string;
  claimMode: "Open" | "ApprovalGated";
  domainTags: string[];
  requirements: Array<{ actionId: string; requiredCount: number; note?: string }>;
  seriesLinks: Array<{
    chainId: number;
    moduleAddress: Address;
    poolId: string;
    commitmentSeriesId: string;
  }>;
};

export type SavedOfferRecord = {
  savedOfferId: string;
  payload: SavedOfferPayloadV1;
  version: number;
  updatedAt: string;
};

export type SavedOfferApiErrorCode =
  | PublicApiError["errorCode"]
  | "authentication_required"
  | "challenge_invalid"
  | "challenge_expired"
  | "signature_invalid"
  | "session_expired"
  | "version_conflict"
  | "owner_limit_exceeded"
  | "chain_unsupported";

export type SavedOfferApiError = Omit<PublicApiError, "errorCode"> & {
  errorCode: SavedOfferApiErrorCode;
  currentVersion?: number;
};

export type SavedOfferValidationResult =
  | { ok: true; value: SavedOfferPayloadV1 }
  | { ok: false; error: SavedOfferApiError };

export type SavedOffersChallengeRequest = { chainId: number; owner: Address };
export type SavedOffersChallengeResponse = {
  ok: true;
  nonce: string;
  audience: string;
  expiresAt: number;
};
export type SavedOffersSessionRequest = {
  chainId: number;
  owner: Address;
  nonce: string;
  issuedAt: number;
  signature: `0x${string}`;
  factory?: Address;
  factoryData?: `0x${string}`;
};
export type SavedOffersSessionResponse = { ok: true; token: string; expiresAt: number };

export type SavedOffersSessionMessageInput = {
  version: 1;
  chainId: number;
  owner: Address | string;
  nonce: string;
  audience: string;
  issuedAt: number;
};
