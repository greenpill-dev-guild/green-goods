import type { Address } from "@green-goods/shared";

export interface CampaignCookieJarCreateWorkspaceProps {
  onCancel: () => void;
  initialCreatedJarAddress?: Address;
  initialSubmittedHash?: string;
}
