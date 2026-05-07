import { describe, expect, it } from "vitest";
import type { Address, Garden } from "@green-goods/shared";
import {
  buildCampaignCookieJarCreatePayload,
  canCreateCampaignCookieJar,
  canSyncCampaignCookieJarAllowlist,
  deriveCampaignCookieJarSlug,
  filterCampaignCookieJarCampaigns,
  filterCampaignCookieJarGardens,
  resolveCampaignCookieJarManageDraft,
  isValidCampaignCookieJarMetadataUrl,
  isUsableCampaignCookieJarTokenDecimals,
  resolveCampaignCookieJarCreateFollowUp,
} from "./campaignCookieJarPanel.model";

const GARDEN_A = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN_B = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN_A = "0x3333333333333333333333333333333333333333" as Address;
const TOKEN_B = "0x4444444444444444444444444444444444444444" as Address;
const JAR = "0x5555555555555555555555555555555555555555" as Address;

function garden(
  id: Address,
  name: string,
  tokenAddress: Address
): Pick<Garden, "id" | "name" | "tokenAddress"> {
  return { id, name, tokenAddress };
}

describe("campaign cookie jar admin model", () => {
  it("filters selected gardens by derived slug as well as name and address", () => {
    const result = filterCampaignCookieJarGardens(
      [garden(GARDEN_A, "North Garden", TOKEN_A), garden(GARDEN_B, "South Garden", TOKEN_B)],
      "north-garden"
    );

    expect(result.map((entry) => entry.id)).toEqual([GARDEN_A]);
  });

  it("turns noncanonical creation results into a pending manual-address follow-up", () => {
    expect(resolveCampaignCookieJarCreateFollowUp({ hash: "safe-tx-1" })).toEqual({
      kind: "pending",
      hash: "safe-tx-1",
    });
    expect(resolveCampaignCookieJarCreateFollowUp({ hash: "0xtx", jarAddress: JAR })).toEqual({
      kind: "ready",
      jarAddress: JAR,
    });
  });

  it("requires jar ownership, valid addresses, and an allowlist or metadata change before syncing", () => {
    expect(
      canSyncCampaignCookieJarAllowlist({
        jarAddress: JAR,
        isJarOwner: false,
        invalidAddressCount: 0,
        grantCount: 1,
        revokeCount: 0,
      })
    ).toBe(false);

    expect(
      canSyncCampaignCookieJarAllowlist({
        jarAddress: JAR,
        isJarOwner: true,
        invalidAddressCount: 0,
        grantCount: 1,
        revokeCount: 1,
      })
    ).toBe(true);

    expect(
      canSyncCampaignCookieJarAllowlist({
        jarAddress: JAR,
        isJarOwner: true,
        invalidAddressCount: 0,
        grantCount: 0,
        revokeCount: 0,
        metadataChanged: true,
        canUpdateMetadata: true,
      })
    ).toBe(true);

    expect(
      canSyncCampaignCookieJarAllowlist({
        jarAddress: JAR,
        isJarOwner: true,
        invalidAddressCount: 0,
        grantCount: 0,
        revokeCount: 0,
        metadataChanged: true,
        canUpdateMetadata: false,
      })
    ).toBe(false);

    expect(
      canSyncCampaignCookieJarAllowlist({
        jarAddress: JAR,
        isJarOwner: true,
        invalidAddressCount: 0,
        grantCount: 0,
        revokeCount: 0,
        metadataChanged: true,
        canUpdateMetadata: true,
        metadataUrlsValid: false,
      })
    ).toBe(false);
  });

  it("requires confirmed ERC20 decimals before enabling campaign creation", () => {
    const baseParams = {
      factoryAddress: GARDEN_A,
      tokenAddress: TOKEN_A,
      tokenDecimalsConfirmed: true,
      jarOwner: JAR,
      campaignTitle: "Earth Week",
      hasValidClaimConfig: true,
      allowlistCount: 1,
      invalidAddressCount: 0,
      isDeployer: true,
      metadataUrlsValid: true,
    };

    expect(canCreateCampaignCookieJar(baseParams)).toBe(true);
    expect(
      canCreateCampaignCookieJar({
        ...baseParams,
        tokenDecimalsConfirmed: false,
      })
    ).toBe(false);
    expect(
      canCreateCampaignCookieJar({
        ...baseParams,
        metadataUrlsValid: false,
      })
    ).toBe(false);
  });

  it("derives a stable metadata slug from the campaign name", () => {
    expect(deriveCampaignCookieJarSlug(" Earth Week / GoodDollar! ")).toBe("earth-week-gooddollar");
    expect(deriveCampaignCookieJarSlug("")).toBe("campaign-cookie-jar");
  });

  it("builds campaign creation params with hidden one-time purpose defaults", () => {
    const payload = buildCampaignCookieJarCreatePayload({
      factoryAddress: GARDEN_A,
      campaignTitle: "Earth Week",
      campaignDescription: "Operator rewards",
      campaignImage: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzd",
      campaignExternalUrl: "https://greengoods.app/cookies?campaign=earth-week",
      tokenAddress: TOKEN_A,
      jarOwner: JAR,
      allowlist: [GARDEN_B],
      sourceGardens: [GARDEN_A],
      extraAllowlist: [],
      fixedAmount: 10n,
      withdrawalInterval: 0n,
    });

    expect(payload).toMatchObject({
      title: "Earth Week",
      slug: "earth-week",
      description: "Operator rewards",
      oneTimeWithdrawal: true,
      strictPurpose: true,
      withdrawalType: "fixed",
      fixedAmount: 10n,
      maxWithdrawal: 10n,
      minDeposit: 0n,
    });
  });

  it("prefills management drafts from selected campaign metadata", () => {
    const draft = resolveCampaignCookieJarManageDraft({
      address: JAR,
      jarAddress: JAR,
      slug: "earth-week",
      label: "Earth Week",
      title: "Earth Week",
      rawMetadata: "",
      source: "indexed",
      metadata: {
        kind: "green-goods.campaign-cookie-jar",
        version: 1,
        slug: "earth-week",
        title: "Earth Week",
        description: "Campaign details",
        image: "https://cdn.greengoods.app/cookie.webp",
        externalUrl: "https://greengoods.app/cookies?campaign=earth-week",
        sourceGardens: [GARDEN_A],
        operatorPolicy: "one-operator-per-garden",
        extraAllowlist: [GARDEN_B],
        chainId: 11155111,
        createdAt: 1770000000,
      },
    });

    expect(draft).toEqual({
      jarAddress: JAR,
      description: "Campaign details",
      image: "https://cdn.greengoods.app/cookie.webp",
      externalUrl: "https://greengoods.app/cookies?campaign=earth-week",
      selectedGardenIds: [GARDEN_A],
      extraAddresses: GARDEN_B,
    });
  });

  it("filters campaign jars by title, slug, and jar address", () => {
    const campaigns = [
      {
        address: JAR,
        jarAddress: JAR,
        slug: "earth-week",
        label: "Earth Week",
        title: "Earth Week",
        metadata: null,
        rawMetadata: "",
        source: "indexed" as const,
      },
      {
        address: GARDEN_B,
        jarAddress: GARDEN_B,
        slug: "good-dollar",
        label: "GoodDollar",
        title: "GoodDollar",
        metadata: null,
        rawMetadata: "",
        source: "indexed" as const,
      },
    ];

    expect(filterCampaignCookieJarCampaigns(campaigns, "earth")).toEqual([campaigns[0]]);
    expect(filterCampaignCookieJarCampaigns(campaigns, GARDEN_B.slice(0, 10))).toEqual([
      campaigns[1],
    ]);
  });

  it("accepts only positive integer token decimals for create flow scaling", () => {
    expect(isUsableCampaignCookieJarTokenDecimals(6)).toBe(true);
    expect(isUsableCampaignCookieJarTokenDecimals(18)).toBe(true);
    expect(isUsableCampaignCookieJarTokenDecimals(0)).toBe(false);
    expect(isUsableCampaignCookieJarTokenDecimals("18")).toBe(false);
    expect(isUsableCampaignCookieJarTokenDecimals(undefined)).toBe(false);
  });

  it("accepts only web, site-relative, and content-addressed metadata URLs", () => {
    expect(isValidCampaignCookieJarMetadataUrl("")).toBe(true);
    expect(isValidCampaignCookieJarMetadataUrl("https://cdn.greengoods.app/campaign.webp")).toBe(
      true
    );
    expect(isValidCampaignCookieJarMetadataUrl("/images/hero-cookie.webp")).toBe(true);
    expect(isValidCampaignCookieJarMetadataUrl("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26n")).toBe(
      true
    );
    expect(isValidCampaignCookieJarMetadataUrl("ar://example")).toBe(false);
    expect(isValidCampaignCookieJarMetadataUrl("javascript:alert(1)")).toBe(false);
  });
});
