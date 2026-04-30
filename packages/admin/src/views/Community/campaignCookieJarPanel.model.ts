import { derivePublicGardenSlug, type Address, type Garden } from "@green-goods/shared";

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
}): boolean {
  return (
    Boolean(params.jarAddress && params.isJarOwner) &&
    params.invalidAddressCount === 0 &&
    (params.grantCount > 0 || params.revokeCount > 0)
  );
}
