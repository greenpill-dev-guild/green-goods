import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import { withDataRouter } from "../../../../../../shared/.storybook/decorators";
import {
  campaignCookieJarStoryDecorators,
  STORYBOOK_CAMPAIGN_JAR,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignCookieJarCreateWorkspace } from "./CampaignCookieJarCreateWorkspace";

const meta = {
  title: "Admin/Workflows/Community/Payouts/CreateCookieJar",
  component: CampaignCookieJarCreateWorkspace,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Create Cookie Jar: the flow dialog opened from Campaign Cookie Jars on the protocol garden's Payouts (DL-046). Campaign, Payout, Eligible gardens, and Review, with Advanced as a detour on Review; the created and submitted states are its final state.",
      },
    },
  },
  decorators: [withDataRouter("/community/payouts"), ...campaignCookieJarStoryDecorators],
  args: { onClose: fn() },
} satisfies Meta<typeof CampaignCookieJarCreateWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first step; Next and Back move between steps. */
export const CampaignStep: Story = {
  tags: ["storybook-ci"],
  play: async () => {
    // The dialog fades in, so each step heading is awaited until it shows.
    const showsStep = (name: string) =>
      waitFor(() => expect(screen.getByRole("heading", { name })).toBeVisible());
    await showsStep("Campaign");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await showsStep("Payout");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await showsStep("Campaign");
  },
};

export const PayoutStep: Story = { args: { initialStep: 1 } };

export const GardensStep: Story = { args: { initialStep: 2 } };

/** Review, with Advanced as a detour; Create waits for a complete jar. */
export const ReviewStep: Story = { args: { initialStep: 3 } };

export const Created: Story = { args: { initialCreatedJarAddress: STORYBOOK_CAMPAIGN_JAR } };

/** A Safe-style wallet queued the create; the jar address is not known yet. */
export const SubmittedNeedsJarAddress: Story = {
  args: { initialSubmittedHash: "safe-tx-queued-1" },
};
