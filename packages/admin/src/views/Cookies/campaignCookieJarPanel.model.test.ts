import { describe, expect, it } from "vitest";
import type { Address, Garden } from "@green-goods/shared";
import {
  canCreateCampaignCookieJar,
  canSyncCampaignCookieJarAllowlist,
  filterCampaignCookieJarGardens,
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
  });

  it("requires confirmed ERC20 decimals before enabling campaign creation", () => {
    const baseParams = {
      factoryAddress: GARDEN_A,
      tokenAddress: TOKEN_A,
      tokenDecimalsConfirmed: true,
      jarOwner: JAR,
      campaignTitle: "Earth Week",
      campaignSlug: "earth-week",
      hasValidClaimConfig: true,
      allowlistCount: 1,
      invalidAddressCount: 0,
      isDeployer: true,
    };

    expect(canCreateCampaignCookieJar(baseParams)).toBe(true);
    expect(
      canCreateCampaignCookieJar({
        ...baseParams,
        tokenDecimalsConfirmed: false,
      })
    ).toBe(false);
  });

  it("accepts only positive integer token decimals for create flow scaling", () => {
    expect(isUsableCampaignCookieJarTokenDecimals(6)).toBe(true);
    expect(isUsableCampaignCookieJarTokenDecimals(18)).toBe(true);
    expect(isUsableCampaignCookieJarTokenDecimals(0)).toBe(false);
    expect(isUsableCampaignCookieJarTokenDecimals("18")).toBe(false);
    expect(isUsableCampaignCookieJarTokenDecimals(undefined)).toBe(false);
  });
});
