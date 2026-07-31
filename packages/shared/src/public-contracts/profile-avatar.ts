import { CID } from "multiformats/cid";
import type { Address, PublicApiError } from "./index";

export const PROFILE_AVATAR_ROUTE = "/public/profile-avatars/:chainId/:address" as const;

export type ProfileAvatarApiErrorCode =
  | PublicApiError["errorCode"]
  | "signature_invalid"
  | "signature_expired"
  | "version_conflict"
  | "chain_unsupported";

export type ProfileAvatarApiError = Omit<PublicApiError, "errorCode"> & {
  errorCode: ProfileAvatarApiErrorCode;
};

export type ProfileAvatarAction = "set" | "clear";

export type ProfileAvatarRecord = {
  chainId: number;
  address: Address;
  avatarUri: string | null;
  version: number;
  updatedAt: string | null;
};

export type ProfileAvatarMutation = {
  avatarUri: string | null;
  expectedVersion: number;
  issuedAt: number;
  signature: `0x${string}`;
  factory?: Address;
  factoryData?: `0x${string}`;
};

export type ProfileAvatarMessageInput = Pick<
  ProfileAvatarMutation,
  "avatarUri" | "expectedVersion" | "issuedAt"
> & {
  chainId: number;
  address: Address | string;
};

export type ProfileAvatarRequestValidationConfig = {
  isAddress?: (value: string) => boolean;
  now?: () => number;
  maxIssuedAtAgeSeconds?: number;
  maxFutureSkewSeconds?: number;
  allowedChainIds?: readonly number[];
};

export type ProfileAvatarValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProfileAvatarApiError };

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/i;
const HEX_PATTERN = /^0x[0-9a-fA-F]+$/;

function error(
  message: string,
  field?: string,
  errorCode: ProfileAvatarApiErrorCode = "invalid_request"
): ProfileAvatarApiError {
  return {
    ok: false,
    errorCode,
    message,
    ...(field ? { fieldErrors: { [field]: message } } : {}),
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

export function normalizeProfileAvatarAddress(value: string): Address | null {
  return ADDRESS_PATTERN.test(value) ? (value.toLowerCase() as Address) : null;
}

export function isCanonicalProfileAvatarUri(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("ipfs://")) return false;
  const cidText = value.slice(7);
  if (!cidText || cidText.includes("/") || cidText.includes("?") || cidText.includes("#")) {
    return false;
  }
  try {
    return CID.parse(cidText).toString() === cidText;
  } catch {
    return false;
  }
}

export function buildProfileAvatarMessage(input: ProfileAvatarMessageInput): string {
  const address = normalizeProfileAvatarAddress(input.address);
  if (
    !isPositiveInteger(input.chainId) ||
    !address ||
    !isNonNegativeInteger(input.expectedVersion)
  ) {
    throw new Error("Invalid profile avatar message input");
  }
  if (
    !isNonNegativeInteger(input.issuedAt) ||
    (input.avatarUri !== null && !isCanonicalProfileAvatarUri(input.avatarUri))
  ) {
    throw new Error("Invalid profile avatar message input");
  }

  const action: ProfileAvatarAction = input.avatarUri === null ? "clear" : "set";
  const avatarUri = input.avatarUri ?? "none";
  return `Green Goods Profile Avatar\nVersion: 1\nChain ID: ${input.chainId}\nAddress: ${address}\nAction: ${action}\nAvatar URI: ${avatarUri}\nExpected Version: ${input.expectedVersion}\nIssued At: ${input.issuedAt}`;
}

export function validateProfileAvatarMutation(
  body: unknown,
  config: ProfileAvatarRequestValidationConfig = {}
): ProfileAvatarValidationResult<ProfileAvatarMutation> {
  const candidate = body as Partial<ProfileAvatarMutation> | null;
  if (!candidate || typeof candidate !== "object")
    return { ok: false, error: error("Invalid request body.") };
  if (candidate.avatarUri !== null && !isCanonicalProfileAvatarUri(candidate.avatarUri)) {
    return { ok: false, error: error("Avatar URI must be a canonical IPFS URI.", "avatarUri") };
  }
  if (!isNonNegativeInteger(candidate.expectedVersion)) {
    return {
      ok: false,
      error: error("Expected version must be a non-negative integer.", "expectedVersion"),
    };
  }
  if (!isNonNegativeInteger(candidate.issuedAt)) {
    return { ok: false, error: error("Issued at must be Unix seconds.", "issuedAt") };
  }
  if (typeof candidate.signature !== "string" || !HEX_PATTERN.test(candidate.signature)) {
    return { ok: false, error: error("A hexadecimal signature is required.", "signature") };
  }
  const hasFactory = candidate.factory !== undefined;
  const hasFactoryData = candidate.factoryData !== undefined;
  if (hasFactory !== hasFactoryData) {
    return {
      ok: false,
      error: error("Factory and factory data must be supplied together.", "factory"),
    };
  }
  if (
    hasFactory &&
    (!normalizeProfileAvatarAddress(candidate.factory as string) ||
      !HEX_PATTERN.test(candidate.factoryData as string))
  ) {
    return { ok: false, error: error("Invalid counterfactual account factory data.", "factory") };
  }
  const now = config.now?.() ?? Math.floor(Date.now() / 1000);
  const maxAge = config.maxIssuedAtAgeSeconds ?? 300;
  const maxFutureSkew = config.maxFutureSkewSeconds ?? 30;
  if (candidate.issuedAt > now + maxFutureSkew || now - candidate.issuedAt > maxAge) {
    return { ok: false, error: error("Signature has expired.", "issuedAt", "signature_expired") };
  }

  return {
    ok: true,
    value: {
      avatarUri: candidate.avatarUri,
      expectedVersion: candidate.expectedVersion,
      issuedAt: candidate.issuedAt,
      signature: candidate.signature as `0x${string}`,
      ...(hasFactory
        ? {
            factory: normalizeProfileAvatarAddress(candidate.factory as string)!,
            factoryData: candidate.factoryData as `0x${string}`,
          }
        : {}),
    },
  };
}

export function validateProfileAvatarRequest(
  chainId: unknown,
  address: unknown,
  mutation: unknown,
  config: ProfileAvatarRequestValidationConfig = {}
): ProfileAvatarValidationResult<ProfileAvatarMessageInput & ProfileAvatarMutation> {
  if (!isPositiveInteger(chainId))
    return { ok: false, error: error("Invalid chain ID.", "chainId") };
  if (config.allowedChainIds && !config.allowedChainIds.includes(chainId)) {
    return { ok: false, error: error("Unsupported chain.", "chainId", "chain_unsupported") };
  }
  const normalizedAddress =
    typeof address === "string" ? normalizeProfileAvatarAddress(address) : null;
  if (!normalizedAddress || (config.isAddress && !config.isAddress(normalizedAddress))) {
    return { ok: false, error: error("Invalid account address.", "address") };
  }
  const parsed = validateProfileAvatarMutation(mutation, config);
  return parsed.ok
    ? { ok: true, value: { chainId, address: normalizedAddress, ...parsed.value } }
    : parsed;
}

export function parseProfileAvatarRecord(value: unknown): ProfileAvatarRecord | null {
  const candidate = value as Partial<ProfileAvatarRecord> | null;
  const address =
    typeof candidate?.address === "string"
      ? normalizeProfileAvatarAddress(candidate.address)
      : null;
  if (
    !candidate ||
    !isPositiveInteger(candidate.chainId) ||
    !address ||
    !isNonNegativeInteger(candidate.version)
  )
    return null;
  if (candidate.avatarUri !== null && !isCanonicalProfileAvatarUri(candidate.avatarUri))
    return null;
  if (
    candidate.updatedAt !== null &&
    (typeof candidate.updatedAt !== "string" || Number.isNaN(Date.parse(candidate.updatedAt)))
  )
    return null;
  return {
    chainId: candidate.chainId,
    address,
    avatarUri: candidate.avatarUri ?? null,
    version: candidate.version,
    updatedAt: candidate.updatedAt ?? null,
  };
}
