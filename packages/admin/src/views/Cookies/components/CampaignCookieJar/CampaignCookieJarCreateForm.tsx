import type { Garden } from "@green-goods/shared/types/domain";
import type {
  CampaignCookieJarPayoutAsset,
  CampaignCookieJarPayoutAssetId,
} from "@green-goods/shared/utils/cookie-jar-campaign";
import type { IntlShape } from "react-intl";
import { CampaignAdvancedSection } from "./CampaignAdvancedSection";
import { CampaignCreateReview } from "./CampaignCreateReview";
import { CampaignDetailsSection } from "./CampaignDetailsSection";
import { CampaignGardenSection } from "./CampaignGardenSection";
import { CampaignPayoutSection } from "./CampaignPayoutSection";

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
  onCreate: () => void;
  onCancel: () => void;
}

export function CampaignCookieJarCreateForm(props: CampaignCookieJarCreateFormProps) {
  const { formatMessage, moduleConfigured, isDeployer, roleLoading, createError } = props;
  return (
    <div className="relative pb-32 lg:pb-0">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-5">
          {!moduleConfigured ? (
            <div className="surface-section text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.factoryMissing",
                defaultMessage:
                  "Cookie Jar factory discovery is not configured on this network yet.",
              })}
            </div>
          ) : null}
          {!isDeployer && !roleLoading ? (
            <div className="surface-section text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.deployerOnly",
                defaultMessage:
                  "This surface is intended for deployer and ops wallets. Connect a deployer wallet to create jars, or the jar owner to sync an existing jar.",
              })}
            </div>
          ) : null}
          {createError ? (
            <div
              className="surface-section border-[rgb(var(--m3-error))] text-body-sm text-[rgb(var(--m3-error))]"
              role="alert"
            >
              {createError.message}
            </div>
          ) : null}
          <CampaignDetailsSection {...props} />
          <CampaignPayoutSection {...props} />
          <CampaignGardenSection {...props} />
          <CampaignAdvancedSection {...props} />
        </div>
        <CampaignCreateReview {...props} />
      </div>
    </div>
  );
}
