import type { Address } from "@green-goods/shared/types/domain";

export interface CampaignCookieJarCreateWorkspaceProps {
  onCancel: () => void;
  initialCreatedJarAddress?: Address;
  initialSubmittedHash?: string;
}
