import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  campaignCookieJarPanelViewProps,
  campaignCookieJarStoryDecorators,
  STORYBOOK_CAMPAIGN_JAR,
  storybookCampaign,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignCookieJarPanelView } from "./CampaignCookieJarPanelView";

const meta: Meta<typeof CampaignCookieJarPanelView> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/PanelView",
  component: CampaignCookieJarPanelView,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarPanelView>;

export const Default: Story = {
  args: campaignCookieJarPanelViewProps,
};

const STEWARD = "0x8888888888888888888888888888888888888888";
const FORMER_STEWARD = "0x9999999999999999999999999999999999999999";

/** The manage dialog open on a jar its owner can sync: one steward joins, one leaves. */
const manageArgs = {
  ...campaignCookieJarPanelViewProps,
  selectedCampaign: storybookCampaign,
  selectedJarAddress: STORYBOOK_CAMPAIGN_JAR,
  syncJar: { jar: { isOwner: true } },
  syncAggregation: { allowlist: [STEWARD], invalidAddresses: [] },
  syncDiff: { grant: [STEWARD], revoke: [FORMER_STEWARD] },
} as const;

/** How many signatures the sync takes shows before anyone presses Sync Allowlist. */
export const ReadyToSync: Story = {
  args: { ...manageArgs, canSync: true, syncSignatureLine: "1 signature" },
};

/** An earlier sync nobody can confirm yet holds this jar's next one. */
export const HeldSync: Story = {
  args: {
    ...manageArgs,
    syncHold: {
      title: "We couldn’t confirm your last sync.",
      message:
        "It could still land, so this jar can’t sync again until you check again or move on. If it lands after you move on, its allowlist changes still take effect.",
      detail: "On chain now: 0 of 1 granted. 0 of 1 revoked. Metadata not updated yet.",
      hasUnreadValues: false,
      isSettling: false,
      onCheckAgain: fn(),
      onMoveOn: fn(),
    },
  },
};
