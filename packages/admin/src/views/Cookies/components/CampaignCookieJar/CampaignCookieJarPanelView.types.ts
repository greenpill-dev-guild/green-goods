import type { Address, CampaignCookieJarCampaign, Garden } from "@green-goods/shared";
import type { IntlShape } from "react-intl";

export interface CampaignCookieJarPanelViewProps {
  formatMessage: IntlShape["formatMessage"];
  moduleConfigured: boolean;
  isDeployer: boolean;
  roleLoading: boolean;
  campaigns: readonly CampaignCookieJarCampaign[];
  campaignsLoading: boolean;
  campaignsError: Error | null;
  campaignSearch: string;
  setCampaignSearch: (value: string) => void;
  visibleCampaigns: readonly CampaignCookieJarCampaign[];
  gardensByAddress: Map<string, Garden>;
  setSelectedCampaign: (campaign: CampaignCookieJarCampaign | null) => void;
  selectedCampaign: CampaignCookieJarCampaign | null;
  selectedCampaignTitle: string;
  selectedCampaignPublicUrl: string;
  syncAllowlist: { isPending: boolean };
  updateMetadata: { isPending: boolean };
  canSync: boolean;
  handleSync: () => void;
  syncCampaignDescription: string;
  setSyncCampaignDescription: (value: string) => void;
  syncCampaignImage: string;
  setSyncCampaignImage: (value: string) => void;
  syncCampaignImageFile: File | null;
  setSyncCampaignImageFile: (file: File | null) => void;
  gardens: readonly Garden[];
  syncGardenIds: readonly string[];
  setSyncGardenIds: (gardenIds: string[]) => void;
  toggleSyncGarden: (gardenId: string) => void;
  selectSyncGardens: (gardenIds: string[]) => void;
  syncGardenSearch: string;
  setSyncGardenSearch: (value: string) => void;
  syncExtraAddresses: string;
  setSyncExtraAddresses: (value: string) => void;
  syncAggregation: {
    allowlist: readonly Address[];
    invalidAddresses: readonly string[];
  };
  syncDiff: {
    grant: readonly Address[];
    revoke: readonly Address[];
  };
  selectedJarAddress: Address | null;
  syncJar: { jar?: { isOwner: boolean } | null };
}
