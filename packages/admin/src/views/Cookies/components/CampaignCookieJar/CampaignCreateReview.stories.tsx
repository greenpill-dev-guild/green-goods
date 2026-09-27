import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignCreateReview } from "./CampaignCreateReview";

const meta: Meta<typeof CampaignCreateReview> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/CreateReview",
  component: CampaignCreateReview,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCreateReview>;

export const Default: Story = {
  render: () => <CampaignCreateReview {...campaignCookieJarCreateFormProps} />,
};

/** Creation failed on chain (a rejected signature here): Review names the error and keeps the jar. */
export const CreateFailed: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <CampaignCreateReview
      {...campaignCookieJarCreateFormProps}
      createError={new Error("The wallet rejected the transaction.")}
    />
  ),
  play: async ({ canvasElement }) => {
    const alert = await within(canvasElement).findByRole("alert");
    await expect(alert).toHaveTextContent("The wallet rejected the transaction.");
  },
};

/** A selected garden without a steward adds nobody who can claim; Review counts it. */
export const GardensWithoutSteward: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <CampaignCreateReview
      {...campaignCookieJarCreateFormProps}
      aggregation={{
        ...campaignCookieJarCreateFormProps.aggregation,
        sources: [
          ...campaignCookieJarCreateFormProps.aggregation.sources,
          { gardenAddress: "0x5555555555555555555555555555555555555555" },
        ],
        missingStewardGardens: ["0x5555555555555555555555555555555555555555"],
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = await canvas.findByText("Gardens without a steward");
    await expect(label.nextElementSibling).toHaveTextContent(/^1$/);
  },
};
