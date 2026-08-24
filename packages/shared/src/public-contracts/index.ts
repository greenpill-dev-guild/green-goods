// Dependency-light public route contracts: no UI frameworks, browser globals, or package-root imports.

import { derivePublicGardenSlug } from "./garden-slug";
import {
  buildPublicFundingAvailabilityKey,
  type ProviderProofEntry,
  type PublicFundingAvailability,
  type PublicFundingAvailabilityKeyInput,
} from "./core";

export { derivePublicGardenSlug } from "./garden-slug";
export {
  createPublicImpactSlice,
  PUBLIC_IMPACT_DEFAULT_PAGE_SIZE,
  PUBLIC_IMPACT_GARDEN_FETCH_CAP,
  PUBLIC_IMPACT_RECORD_FETCH_CAP,
  type PublicImpactEvidenceKind,
  type PublicImpactEvidenceRecord,
  type PublicImpactGardenSource,
  type PublicImpactSlice,
} from "./public-impact";
export { PUBLIC_AGENT_ROUTES } from "./routes";

export {
  PUBLIC_UPLOAD_SIGN_ALLOWED_CATEGORIES,
  validatePublicUploadSignRequest,
} from "./upload-signing";
export type {
  PublicUploadSignValidationConfig,
  PublicUploadSignValidationResult,
} from "./upload-signing";

export * from "./core";
export * from "./saved-offers";

export function validateProviderProofEntry(entry: ProviderProofEntry): string[] {
  const errors: string[] = [];
  if (entry.state === "live" && !entry.proofReference?.trim()) {
    errors.push("live provider proof entries require proofReference");
  }
  return errors;
}

export function createProviderProofRegistry(entries: readonly ProviderProofEntry[] = []) {
  const byKey = new Map<string, ProviderProofEntry>();

  for (const entry of entries) {
    const errors = validateProviderProofEntry(entry);
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
    byKey.set(buildPublicFundingAvailabilityKey(entry), entry);
  }

  return {
    get(input: PublicFundingAvailabilityKeyInput): ProviderProofEntry | undefined {
      return byKey.get(buildPublicFundingAvailabilityKey(input));
    },
    resolve(input: PublicFundingAvailabilityKeyInput): PublicFundingAvailability {
      const availabilityKey = buildPublicFundingAvailabilityKey(input);
      const entry = byKey.get(availabilityKey);
      if (!entry || entry.state === "hidden") {
        return {
          ...input,
          availabilityKey,
          state: "hidden",
          reasonCode: "proof_pending",
          reasonParams: { provider: input.provider, requiredProof: "provider_execution" },
          requiredProof: "provider_execution",
        };
      }
      if (entry.state === "comingSoon") {
        return {
          ...input,
          availabilityKey,
          state: "comingSoon",
          reasonCode: "proof_pending",
          reasonParams: {
            provider: input.provider,
            requiredProof: entry.requiredProof ?? "provider_execution",
          },
          requiredProof: entry.requiredProof ?? "provider_execution",
          proofReference: entry.proofReference,
        };
      }
      return {
        ...input,
        availabilityKey,
        state: "live",
        proofReference: entry.proofReference,
      };
    },
    entries(): ProviderProofEntry[] {
      return [...byKey.values()];
    },
  };
}

const GREENPILL_NYC_OCTANT_VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as const;
const EVMAVERICKS_OCTANT_VAULT = "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc" as const;
const ETHEREUM_WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;

/**
 * Live entries must stay in lockstep with the client Card Endow allowlist
 * (`CARD_ENDOW_PRODUCTION_CAMPAIGN_SLUGS` in the /vaults checkout): every
 * campaign the client exposes for Card Endow needs a matching live entry here,
 * or the agent proof route rejects the receipt AFTER value moved.
 */
export const PUBLIC_PROVIDER_PROOF_ENTRIES: readonly ProviderProofEntry[] = [
  {
    gardenKey: "greenpill-nyc",
    destinationType: "vault",
    destinationAddress: GREENPILL_NYC_OCTANT_VAULT,
    fundingIntent: "endow",
    paymentMethod: "card",
    chainId: 1,
    token: ETHEREUM_WETH,
    provider: "thirdweb",
    sourceRoute: "/vaults",
    state: "live",
    proofReference: "production:greenpill-nyc-card-endow-proof-route-2026-06-03",
  },
  {
    gardenKey: "evmavericks",
    destinationType: "vault",
    destinationAddress: EVMAVERICKS_OCTANT_VAULT,
    fundingIntent: "endow",
    paymentMethod: "card",
    chainId: 1,
    token: ETHEREUM_WETH,
    provider: "thirdweb",
    sourceRoute: "/vaults",
    state: "live",
    proofReference: "production:evmavericks-card-endow-proof-route-2026-06-12",
  },
];
export const publicProviderProofRegistry = createProviderProofRegistry(
  PUBLIC_PROVIDER_PROOF_ENTRIES
);

export type PublicGardenLookupItem = {
  id: string;
  address?: string;
  name?: string;
  location?: string;
};

export type FundGardenResolution =
  | { status: "normal" }
  | {
      status: "matched";
      matchType: "exact" | "slug";
      garden: PublicGardenLookupItem;
      spotlightGardenId: string;
    }
  | {
      status: "fallback";
      reason: "not_found" | "ambiguous_slug";
      messageId: "public.fund.garden.notFound" | "public.fund.garden.ambiguous";
      query: string;
    };

export function resolveFundGardenReference(
  reference: string | undefined,
  gardens: readonly PublicGardenLookupItem[]
): FundGardenResolution {
  const query = reference?.trim().toLowerCase() ?? "";
  if (!query) return { status: "normal" };

  const exact = gardens.find((garden) => {
    const id = garden.id.trim().toLowerCase();
    const address = garden.address?.trim().toLowerCase();
    return id === query || address === query;
  });
  if (exact) {
    return {
      status: "matched",
      matchType: "exact",
      garden: exact,
      spotlightGardenId: exact.id,
    };
  }

  const slugMatches = gardens.filter((garden) => {
    const key = garden.address ?? garden.id;
    return derivePublicGardenSlug(garden.name, key) === query;
  });

  if (slugMatches.length === 1) {
    const garden = slugMatches[0];
    return {
      status: "matched",
      matchType: "slug",
      garden,
      spotlightGardenId: garden.id,
    };
  }

  if (slugMatches.length > 1) {
    return {
      status: "fallback",
      reason: "ambiguous_slug",
      messageId: "public.fund.garden.ambiguous",
      query,
    };
  }

  return {
    status: "fallback",
    reason: "not_found",
    messageId: "public.fund.garden.notFound",
    query,
  };
}
