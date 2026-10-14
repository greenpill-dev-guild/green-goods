import { describe, expect, it } from "vitest";
import { isCampaignCookieJarDraftDirty } from "./campaignCookieJarDraft";

type CampaignCookieJarDraft = Parameters<typeof isCampaignCookieJarDraftDirty>[0];
type CampaignCookieJarDraftDefaults = Parameters<typeof isCampaignCookieJarDraftDirty>[1];

const OWNER = "0x1111111111111111111111111111111111111111";
const DEFAULTS: CampaignCookieJarDraftDefaults = { selectedAssetId: "usdc", jarOwner: OWNER };
const PRISTINE: CampaignCookieJarDraft = {
  campaignTitle: "",
  campaignDescription: "",
  campaignImage: "",
  hasImageFile: false,
  selectedAssetId: "usdc",
  customTokenAddress: "",
  claimAmount: "",
  withdrawalIntervalDays: "0",
  jarOwner: OWNER,
  selectedGardenIds: [],
  extraAddresses: "",
};

describe("isCampaignCookieJarDraftDirty", () => {
  it("reads the flow as it opens as pristine", () => {
    expect(isCampaignCookieJarDraftDirty(PRISTINE, DEFAULTS)).toBe(false);
  });

  it.each<[string, Partial<CampaignCookieJarDraft>]>([
    ["a campaign name", { campaignTitle: "Earth Week" }],
    ["a description", { campaignDescription: "Seed swap payouts" }],
    ["an image URL", { campaignImage: "https://example.org/jar.png" }],
    ["a chosen image file", { hasImageFile: true }],
    ["a claim amount", { claimAmount: "5" }],
    ["a selected garden", { selectedGardenIds: ["0x2222222222222222222222222222222222222222"] }],
    ["an extra address", { extraAddresses: "0x3333333333333333333333333333333333333333" }],
    ["a custom token", { customTokenAddress: "0x4444444444444444444444444444444444444444" }],
    ["another payout asset", { selectedAssetId: "dai" }],
    ["a withdrawal interval", { withdrawalIntervalDays: "7" }],
    ["another jar owner", { jarOwner: "0x5555555555555555555555555555555555555555" }],
  ])("counts %s as an edit to discard", (_label, edit) => {
    expect(isCampaignCookieJarDraftDirty({ ...PRISTINE, ...edit }, DEFAULTS)).toBe(true);
  });

  it("does not count a cleared interval or the owner in another case as an edit", () => {
    expect(
      isCampaignCookieJarDraftDirty(
        {
          ...PRISTINE,
          withdrawalIntervalDays: " ",
          jarOwner: OWNER.toUpperCase().replace("0X", "0x"),
        },
        DEFAULTS
      )
    ).toBe(false);
  });
});
