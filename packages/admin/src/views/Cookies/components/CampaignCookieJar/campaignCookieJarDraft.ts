/** What a steward can edit in Create Cookie Jar before anything is sent. */
interface CampaignCookieJarDraft {
  campaignTitle: string;
  campaignDescription: string;
  campaignImage: string;
  hasImageFile: boolean;
  selectedAssetId: string;
  customTokenAddress: string;
  claimAmount: string;
  withdrawalIntervalDays: string;
  jarOwner: string;
  selectedGardenIds: readonly string[];
  extraAddresses: string;
}

/** The values the flow opens with, which leaving unchanged keeps the draft pristine. */
interface CampaignCookieJarDraftDefaults {
  selectedAssetId: string;
  jarOwner: string;
}

/** Whether closing the flow would lose an edit, so it asks before discarding. */
export function isCampaignCookieJarDraftDirty(
  draft: CampaignCookieJarDraft,
  defaults: CampaignCookieJarDraftDefaults
): boolean {
  return Boolean(
    draft.campaignTitle.trim() ||
      draft.campaignDescription.trim() ||
      draft.campaignImage.trim() ||
      draft.hasImageFile ||
      draft.claimAmount.trim() ||
      draft.selectedGardenIds.length > 0 ||
      draft.extraAddresses.trim() ||
      draft.customTokenAddress.trim() ||
      draft.selectedAssetId !== defaults.selectedAssetId ||
      (draft.withdrawalIntervalDays.trim() || "0") !== "0" ||
      draft.jarOwner.trim().toLowerCase() !== defaults.jarOwner.toLowerCase()
  );
}
