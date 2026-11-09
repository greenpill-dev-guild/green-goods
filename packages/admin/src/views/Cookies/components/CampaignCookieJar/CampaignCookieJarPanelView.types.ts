import type { ReactNode } from "react";
import type {
  TxHoldFeedbackProps,
  TxInlineFeedbackSeverity,
} from "@green-goods/shared/components/feedback/TxInlineFeedback";
import type { CampaignCookieJarCampaign } from "@green-goods/shared/types/cookie-jar";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import type { IntlShape } from "react-intl";

export interface CampaignCookieJarPanelViewProps {
  formatMessage: IntlShape["formatMessage"];
  moduleConfigured: boolean;
  isProtocolTeam: boolean;
  roleLoading: boolean;
  campaigns: readonly CampaignCookieJarCampaign[];
  campaignsLoading: boolean;
  campaignsError: Error | null;
  campaignSearch: string;
  setCampaignSearch: (value: string) => void;
  visibleCampaigns: readonly CampaignCookieJarCampaign[];
  setSelectedCampaign: (campaign: CampaignCookieJarCampaign | null) => void;
  selectedCampaign: CampaignCookieJarCampaign | null;
  selectedCampaignTitle: string;
  selectedCampaignPublicUrl: string;
  syncPending: boolean;
  /** How many signatures the sync takes, once there is one to send. */
  syncSignatureLine: string | null;
  /** A sync whose outcome is unknown, which holds the next one. */
  syncHold: Omit<TxHoldFeedbackProps, "isBusy" | "className"> | null;
  /** Why the last sync did not land, or that nobody can say yet. */
  syncError: { severity: TxInlineFeedbackSeverity; title: string; message: string } | null;
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
  /** An action for the list's header, such as Create Cookie Jar. */
  headerAction?: ReactNode;
}
