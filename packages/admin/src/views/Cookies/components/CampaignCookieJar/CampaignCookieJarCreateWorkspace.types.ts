import type { Address } from "@green-goods/shared/types/domain";

export interface CampaignCookieJarCreateWorkspaceProps {
  /** Close the flow; the Payouts tab routes back to its campaign jars. */
  onClose: () => void;
  /** Stories and tests open the flow on a later step or on its final states. */
  initialStep?: number;
  initialCreatedJarAddress?: Address;
  initialSubmittedHash?: string;
}

export interface CampaignCookieJarCreateDialogProps extends CampaignCookieJarCreateWorkspaceProps {
  open: boolean;
}
