import {
  derivePublicGardenSlug,
  normalizeCampaignMetadataUrl,
  type Address,
  type Garden,
} from "@green-goods/shared";

export interface CampaignCookieJarCreateResult {
  hash: string;
  jarAddress?: Address;
}

export function filterCampaignCookieJarGardens(
  gardens: readonly Pick<Garden, "id" | "name" | "tokenAddress">[],
  search: string
) {
  const query = search.trim().toLowerCase();
  const limit = query ? 20 : 12;
  if (!query) return gardens.slice(0, limit);

  return gardens
    .filter(
      (garden) =>
        garden.name.toLowerCase().includes(query) ||
        derivePublicGardenSlug(garden.name, garden.id).includes(query) ||
        garden.id.toLowerCase().includes(query) ||
        garden.tokenAddress.toLowerCase().includes(query)
    )
    .slice(0, limit);
}

export function resolveCampaignCookieJarCreateFollowUp(
  result: CampaignCookieJarCreateResult
): { kind: "ready"; jarAddress: Address } | { kind: "pending"; hash: string } {
  if (result.jarAddress) {
    return { kind: "ready", jarAddress: result.jarAddress };
  }
  return { kind: "pending", hash: result.hash };
}

export function canSyncCampaignCookieJarAllowlist(params: {
  jarAddress?: Address;
  isJarOwner: boolean;
  invalidAddressCount: number;
  grantCount: number;
  revokeCount: number;
  metadataChanged?: boolean;
  canUpdateMetadata?: boolean;
  metadataUrlsValid?: boolean;
}): boolean {
  const hasAllowlistDiff = params.grantCount > 0 || params.revokeCount > 0;
  const hasMetadataRefresh = Boolean(params.metadataChanged && params.canUpdateMetadata);

  return (
    Boolean(params.jarAddress && params.isJarOwner) &&
    params.invalidAddressCount === 0 &&
    (params.metadataUrlsValid ?? true) &&
    (hasAllowlistDiff || hasMetadataRefresh)
  );
}

export function isUsableCampaignCookieJarTokenDecimals(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isValidCampaignCookieJarMetadataUrl(value: string): boolean {
  return !value.trim() || Boolean(normalizeCampaignMetadataUrl(value));
}

export function canCreateCampaignCookieJar(params: {
  factoryAddress?: Address;
  tokenAddress?: Address | null;
  tokenDecimalsConfirmed: boolean;
  jarOwner?: Address | null;
  campaignTitle: string;
  campaignSlug: string;
  hasValidClaimConfig: boolean;
  allowlistCount: number;
  invalidAddressCount: number;
  metadataUrlsValid?: boolean;
  isDeployer: boolean;
}): boolean {
  return (
    Boolean(
      params.factoryAddress &&
        params.tokenAddress &&
        params.tokenDecimalsConfirmed &&
        params.jarOwner &&
        params.campaignTitle.trim() &&
        params.campaignSlug.trim() &&
        params.hasValidClaimConfig &&
        params.allowlistCount > 0 &&
        (params.metadataUrlsValid ?? true) &&
        params.isDeployer
    ) && params.invalidAddressCount === 0
  );
}
