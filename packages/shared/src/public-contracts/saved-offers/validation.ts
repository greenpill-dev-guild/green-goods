import type { Address } from "../../types/domain";
import {
  SAVED_OFFER_MAX_BYTES,
  SAVED_OFFER_MAX_REQUIREMENTS,
  SAVED_OFFER_MAX_SERIES_LINKS,
  SAVED_OFFER_SCHEMA_VERSION,
  type SavedOfferApiError,
  type SavedOfferApiErrorCode,
  type SavedOfferPayloadV1,
  type SavedOfferPersistenceState,
  type SavedOffersSessionMessageInput,
  type SavedOffersSessionRequest,
  type SavedOfferValidationResult,
} from "./types";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const HEX_PATTERN = /^0x[0-9a-fA-F]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UINT_PATTERN = /^(0|[1-9][0-9]*)$/;
const UINT256_MAX = (1n << 256n) - 1n;
const PAYLOAD_KEYS = [
  "schemaVersion",
  "savedOfferId",
  "title",
  "description",
  "commitmentKind",
  "unitLabel",
  "targetUnits",
  "claimMode",
  "domainTags",
  "requirements",
  "seriesLinks",
] as const;

export function normalizeSavedOfferAddress(value: string): Address | null {
  return ADDRESS_PATTERN.test(value) ? (value.toLowerCase() as Address) : null;
}

export function canonicalSavedOfferPayload(payload: SavedOfferPayloadV1): string {
  return JSON.stringify({
    schemaVersion: payload.schemaVersion,
    savedOfferId: payload.savedOfferId,
    title: payload.title,
    description: payload.description,
    commitmentKind: payload.commitmentKind,
    unitLabel: payload.unitLabel,
    targetUnits: payload.targetUnits,
    claimMode: payload.claimMode,
    domainTags: payload.domainTags,
    requirements: payload.requirements.map((requirement) => ({
      actionId: requirement.actionId,
      requiredCount: requirement.requiredCount,
      ...(requirement.note === undefined ? {} : { note: requirement.note }),
    })),
    seriesLinks: payload.seriesLinks.map((link) => ({
      chainId: link.chainId,
      moduleAddress: link.moduleAddress,
      poolId: link.poolId,
      commitmentSeriesId: link.commitmentSeriesId,
    })),
  });
}

export function validateSavedOfferPayload(value: unknown): SavedOfferValidationResult {
  if (!isPlainObject(value) || !hasOnlyKeys(value, PAYLOAD_KEYS)) {
    return invalid("Saved Offer payload must use the canonical schema.");
  }
  if (value.schemaVersion !== SAVED_OFFER_SCHEMA_VERSION) {
    return invalid("Unsupported Saved Offer schema version.", "schemaVersion");
  }
  if (typeof value.savedOfferId !== "string" || !UUID_PATTERN.test(value.savedOfferId)) {
    return invalid("Saved Offer ID must be a canonical UUID.", "savedOfferId");
  }
  if (!isCanonicalText(value.title, false)) return invalid("A title is required.", "title");
  if (!isCanonicalText(value.description, true)) {
    return invalid("Description must be canonical text.", "description");
  }
  if (value.commitmentKind !== "DomainImpact" && value.commitmentKind !== "SupportService") {
    return invalid("Unsupported commitment kind.", "commitmentKind");
  }
  if (!isCanonicalText(value.unitLabel, false)) {
    return invalid("A unit label is required.", "unitLabel");
  }
  if (!isUint256Text(value.targetUnits)) {
    return invalid("Target units must be canonical uint256 text.", "targetUnits");
  }
  if (value.claimMode !== "Open" && value.claimMode !== "ApprovalGated") {
    return invalid("Unsupported claim mode.", "claimMode");
  }
  if (!Array.isArray(value.domainTags)) return invalid("Domain tags must be an array.");
  const normalizedTags = new Set<string>();
  for (const tag of value.domainTags) {
    if (!isCanonicalText(tag, false)) return invalid("Domain tags must be canonical text.");
    const normalized = tag.normalize("NFKC").toLocaleLowerCase("en-US");
    if (normalizedTags.has(normalized)) return invalid("Domain tags must be unique.");
    normalizedTags.add(normalized);
  }
  if (
    !Array.isArray(value.requirements) ||
    value.requirements.length > SAVED_OFFER_MAX_REQUIREMENTS
  ) {
    return invalid(`No more than ${SAVED_OFFER_MAX_REQUIREMENTS} requirements are allowed.`);
  }
  const requirements: SavedOfferPayloadV1["requirements"] = [];
  for (const raw of value.requirements) {
    if (!isPlainObject(raw) || !hasOnlyKeys(raw, ["actionId", "requiredCount", "note"])) {
      return invalid("Requirements must use the canonical schema.");
    }
    if (!isUint256Text(raw.actionId)) return invalid("Action ID must be canonical uint256 text.");
    if (
      !Number.isSafeInteger(raw.requiredCount) ||
      (raw.requiredCount as number) <= 0 ||
      (raw.requiredCount as number) > 0xffffffff
    ) {
      return invalid("Required count must be a positive uint32.");
    }
    if (raw.note !== undefined && !isCanonicalText(raw.note, true)) {
      return invalid("Requirement note must be canonical text.");
    }
    requirements.push({
      actionId: raw.actionId as string,
      requiredCount: raw.requiredCount as number,
      ...(raw.note === undefined ? {} : { note: raw.note as string }),
    });
  }
  if (
    !Array.isArray(value.seriesLinks) ||
    value.seriesLinks.length > SAVED_OFFER_MAX_SERIES_LINKS
  ) {
    return invalid(`No more than ${SAVED_OFFER_MAX_SERIES_LINKS} series links are allowed.`);
  }
  const seriesLinks: SavedOfferPayloadV1["seriesLinks"] = [];
  const linkKeys = new Set<string>();
  for (const raw of value.seriesLinks) {
    if (
      !isPlainObject(raw) ||
      !hasOnlyKeys(raw, ["chainId", "moduleAddress", "poolId", "commitmentSeriesId"])
    ) {
      return invalid("Series links must use the canonical schema.");
    }
    const moduleAddress =
      typeof raw.moduleAddress === "string" ? normalizeSavedOfferAddress(raw.moduleAddress) : null;
    if (
      !Number.isSafeInteger(raw.chainId) ||
      (raw.chainId as number) <= 0 ||
      !moduleAddress ||
      moduleAddress !== raw.moduleAddress ||
      !isUint256Text(raw.poolId) ||
      !isUint256Text(raw.commitmentSeriesId)
    ) {
      return invalid("Series link identity must be canonical.");
    }
    const link = {
      chainId: raw.chainId as number,
      moduleAddress,
      poolId: raw.poolId as string,
      commitmentSeriesId: raw.commitmentSeriesId as string,
    };
    const linkKey = `${link.chainId}:${link.moduleAddress}:${link.poolId}:${link.commitmentSeriesId}`;
    if (linkKeys.has(linkKey)) return invalid("Series links must be unique.");
    linkKeys.add(linkKey);
    seriesLinks.push(link);
  }
  const parsed: SavedOfferPayloadV1 = {
    schemaVersion: 1,
    savedOfferId: value.savedOfferId,
    title: value.title as string,
    description: value.description as string,
    commitmentKind: value.commitmentKind,
    unitLabel: value.unitLabel as string,
    targetUnits: value.targetUnits as string,
    claimMode: value.claimMode,
    domainTags: value.domainTags as string[],
    requirements,
    seriesLinks,
  };
  if (
    new TextEncoder().encode(canonicalSavedOfferPayload(parsed)).byteLength > SAVED_OFFER_MAX_BYTES
  ) {
    return invalid("Saved Offer payload is too large.");
  }
  return { ok: true, value: parsed };
}

export function buildSavedOffersSessionMessage(input: SavedOffersSessionMessageInput): string {
  const owner = normalizeSavedOfferAddress(input.owner);
  if (
    input.version !== 1 ||
    !Number.isSafeInteger(input.chainId) ||
    input.chainId <= 0 ||
    !owner ||
    !isOpaqueValue(input.nonce) ||
    !isCanonicalText(input.audience, false) ||
    !Number.isSafeInteger(input.issuedAt) ||
    input.issuedAt < 0
  ) {
    throw new Error("Invalid Saved Offers session message input");
  }
  return `Green Goods Saved Offers Session\nVersion: 1\nChain ID: ${input.chainId}\nOwner: ${owner}\nNonce: ${input.nonce}\nAudience: ${input.audience}\nIssued At: ${input.issuedAt}`;
}

export function validateSavedOffersSessionRequest(
  value: unknown
): { ok: true; value: SavedOffersSessionRequest } | { ok: false; error: SavedOfferApiError } {
  if (!isPlainObject(value)) return invalid("Invalid session request.");
  const owner = typeof value.owner === "string" ? normalizeSavedOfferAddress(value.owner) : null;
  const hasFactory = value.factory !== undefined;
  const hasFactoryData = value.factoryData !== undefined;
  if (
    !Number.isSafeInteger(value.chainId) ||
    (value.chainId as number) <= 0 ||
    !owner ||
    !isOpaqueValue(value.nonce) ||
    !Number.isSafeInteger(value.issuedAt) ||
    (value.issuedAt as number) < 0 ||
    typeof value.signature !== "string" ||
    !HEX_PATTERN.test(value.signature) ||
    (value.signature.length - 2) % 2 !== 0 ||
    hasFactory !== hasFactoryData
  ) {
    return invalid("Invalid session request.");
  }
  const factory =
    hasFactory && typeof value.factory === "string"
      ? normalizeSavedOfferAddress(value.factory)
      : null;
  if (
    hasFactory &&
    (!factory ||
      typeof value.factoryData !== "string" ||
      !HEX_PATTERN.test(value.factoryData) ||
      (value.factoryData.length - 2) % 2 !== 0)
  ) {
    return invalid("Invalid counterfactual account factory data.");
  }
  return {
    ok: true,
    value: {
      chainId: value.chainId as number,
      owner,
      nonce: value.nonce as string,
      issuedAt: value.issuedAt as number,
      signature: value.signature as `0x${string}`,
      ...(factory ? { factory, factoryData: value.factoryData as `0x${string}` } : {}),
    },
  };
}

export function savedOfferPersistenceAfterFailure(input: {
  online: boolean;
  errorCode?: SavedOfferApiErrorCode;
}): SavedOfferPersistenceState {
  if (!input.online) return "OFFLINE_LOCAL";
  return input.errorCode === "version_conflict" ? "VERSION_CONFLICT" : "SAVE_FAILED";
}

export function savedOfferApiError(
  errorCode: SavedOfferApiErrorCode,
  message: string,
  field?: string
): SavedOfferApiError {
  return { ok: false, errorCode, message, ...(field ? { fieldErrors: { [field]: message } } : {}) };
}

export function parseSavedOfferApiError(value: unknown, status: number): SavedOfferApiError {
  if (
    isPlainObject(value) &&
    value.ok === false &&
    typeof value.errorCode === "string" &&
    typeof value.message === "string"
  ) {
    return value as SavedOfferApiError;
  }
  return savedOfferApiError(
    status === 401 ? "authentication_required" : "provider_unavailable",
    "Saved Offers are unavailable right now."
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  return (
    actual.every((key) => allowed.includes(key)) &&
    expected.filter((key) => key !== "note").every((key) => key in value)
  );
}

function isCanonicalText(value: unknown, allowEmpty: boolean): value is string {
  return (
    typeof value === "string" &&
    value === value.normalize("NFKC") &&
    value === value.trim() &&
    (allowEmpty || value.length > 0)
  );
}

function isUint256Text(value: unknown): value is string {
  if (typeof value !== "string" || !UINT_PATTERN.test(value)) return false;
  try {
    return BigInt(value) <= UINT256_MAX;
  } catch {
    return false;
  }
}

function isOpaqueValue(value: unknown): value is string {
  return typeof value === "string" && value.length >= 6 && value.length <= 256 && !/\s/.test(value);
}

function invalid(message: string, field?: string): { ok: false; error: SavedOfferApiError } {
  return { ok: false, error: savedOfferApiError("invalid_request", message, field) };
}
