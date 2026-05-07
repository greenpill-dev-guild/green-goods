import {
  derivePublicGardenSlug,
  normalizeCampaignMetadataUrl,
  type Address,
  type CampaignCookieJarCampaign,
  type CampaignCookieJarMetadata,
  type CreateCampaignCookieJarParams,
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

export function filterCampaignCookieJarCampaigns(
  campaigns: readonly CampaignCookieJarCampaign[],
  search: string
): CampaignCookieJarCampaign[] {
  const query = search.trim().toLowerCase();
  if (!query) return [...campaigns];

  return campaigns.filter((campaign) => {
    const metadata = campaign.metadata;
    return [
      campaign.title,
      campaign.label,
      campaign.slug,
      campaign.address,
      metadata?.description,
      metadata?.externalUrl,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(query));
  });
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

export function deriveCampaignCookieJarSlug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "campaign-cookie-jar"
  );
}

export function buildCampaignCookieJarCreatePayload(params: {
  factoryAddress: Address;
  campaignTitle: string;
  campaignDescription?: string;
  campaignImage?: string;
  campaignExternalUrl?: string;
  tokenAddress: Address;
  jarOwner: Address;
  allowlist: Address[];
  sourceGardens: Address[];
  extraAllowlist: Address[];
  fixedAmount: bigint;
  withdrawalInterval: bigint;
}): CreateCampaignCookieJarParams {
  return {
    factoryAddress: params.factoryAddress,
    title: params.campaignTitle,
    slug: deriveCampaignCookieJarSlug(params.campaignTitle),
    description: params.campaignDescription,
    image: params.campaignImage,
    externalUrl: params.campaignExternalUrl,
    tokenAddress: params.tokenAddress,
    jarOwner: params.jarOwner,
    allowlist: params.allowlist,
    sourceGardens: params.sourceGardens,
    extraAllowlist: params.extraAllowlist,
    fixedAmount: params.fixedAmount,
    maxWithdrawal: params.fixedAmount,
    withdrawalInterval: params.withdrawalInterval,
    minDeposit: 0n,
    oneTimeWithdrawal: true,
    strictPurpose: true,
    withdrawalType: "fixed",
  };
}

function resolveCampaignMetadata(
  campaign: Pick<CampaignCookieJarCampaign, "metadata">,
  currentMetadata?: CampaignCookieJarMetadata | null
): CampaignCookieJarMetadata | null {
  return currentMetadata ?? campaign.metadata ?? null;
}

export function resolveCampaignCookieJarManageDraft(
  campaign: Pick<CampaignCookieJarCampaign, "address" | "metadata">,
  currentMetadata?: CampaignCookieJarMetadata | null
): {
  jarAddress: Address;
  description: string;
  image: string;
  externalUrl: string;
  selectedGardenIds: Address[];
  extraAddresses: string;
} {
  const metadata = resolveCampaignMetadata(campaign, currentMetadata);
  return {
    jarAddress: campaign.address,
    description: metadata?.description ?? "",
    image: metadata?.image ?? "",
    externalUrl: metadata?.externalUrl ?? "",
    selectedGardenIds: metadata?.sourceGardens ?? [],
    extraAddresses: metadata?.extraAllowlist.join("\n") ?? "",
  };
}

export function canCreateCampaignCookieJar(params: {
  factoryAddress?: Address;
  tokenAddress?: Address | null;
  tokenDecimalsConfirmed: boolean;
  jarOwner?: Address | null;
  campaignTitle: string;
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
        params.hasValidClaimConfig &&
        params.allowlistCount > 0 &&
        (params.metadataUrlsValid ?? true) &&
        params.isDeployer
    ) && params.invalidAddressCount === 0
  );
}
