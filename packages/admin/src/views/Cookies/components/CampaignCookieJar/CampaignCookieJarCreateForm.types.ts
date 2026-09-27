import type { Garden } from "@green-goods/shared/types/domain";
import type {
  CampaignCookieJarPayoutAsset,
  CampaignCookieJarPayoutAssetId,
} from "@green-goods/shared/utils/cookie-jar-campaign";
import type { IntlShape } from "react-intl";

/** What each step of the Create Cookie Jar flow reads and edits. */
export interface CampaignCookieJarCreateFormProps {
  formatMessage: IntlShape["formatMessage"];
  moduleConfigured: boolean;
  isDeployer: boolean;
  roleLoading: boolean;
  createError: Error | null;
  createPending: boolean;
  gardensLoading: boolean;
  factoryLoading: boolean;
  payoutAssets: readonly CampaignCookieJarPayoutAsset[];
  defaultPayoutAsset: CampaignCookieJarPayoutAsset | undefined;
  selectedAssetId: CampaignCookieJarPayoutAssetId | "custom";
  setSelectedAssetId: (value: CampaignCookieJarPayoutAssetId | "custom") => void;
  campaignTitle: string;
  setCampaignTitle: (value: string) => void;
  campaignDescription: string;
  setCampaignDescription: (value: string) => void;
  campaignImage: string;
  setCampaignImage: (value: string) => void;
  campaignImageFile: File | null;
  setCampaignImageFile: (value: File | null) => void;
  publicCampaignUrl: string;
  claimAmount: string;
  setClaimAmount: (value: string) => void;
  tokenSymbol: string;
  gardens: readonly Garden[];
  selectedGardenIds: readonly string[];
  toggleGarden: (id: string) => void;
  selectGardens: (ids: string[]) => void;
  clearGardens: () => void;
  gardenSearch: string;
  setGardenSearch: (value: string) => void;
  aggregation: {
    allowlist: readonly string[];
    sources: readonly unknown[];
    missingStewardGardens: readonly unknown[];
    invalidAddresses: readonly string[];
  };
  advancedOpen: boolean;
  setAdvancedOpen: (value: boolean) => void;
  customTokenAddress: string;
  setCustomTokenAddress: (value: string) => void;
  normalizedCustomTokenAddress: string | null;
  customTokenLoading: boolean;
  customTokenError: boolean;
  tokenDecimals: number;
  jarOwner: string;
  setJarOwner: (value: string) => void;
  normalizedJarOwner: string | null;
  withdrawalIntervalDays: string;
  setWithdrawalIntervalDays: (value: string) => void;
  extraAddresses: string;
  setExtraAddresses: (value: string) => void;
  payoutLabel: string;
  canCreate: boolean;
}
