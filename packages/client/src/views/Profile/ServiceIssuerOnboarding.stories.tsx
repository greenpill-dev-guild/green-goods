import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ServiceIssuerOnboarding } from "./ServiceIssuerOnboarding";
import { issuerStoryDraftRecord } from "./serviceIssuerStoryFixtures";

/**
 * A member's draft service in Profile, Account, Service Assets (PRD-1299 `SOnboard`): what they
 * would promise, what stays theirs, and the approval only they sign. Switch the toolbar's
 * Language for Spanish and Portuguese.
 */
const meta: Meta<typeof ServiceIssuerOnboarding> = {
  title: "Client/Profile/ServiceIssuerOnboarding",
  component: ServiceIssuerOnboarding,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-xs text-text-sub-600">
          Fictional Storybook data. Nothing is signed or sent.
        </p>
        <Story />
      </div>
    ),
  ],
  args: {
    record: issuerStoryDraftRecord("review"),
    canSign: true,
    approving: false,
    onApprove: fn().mockResolvedValue(undefined),
    onAskForChanges: fn(),
    onDecline: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof ServiceIssuerOnboarding>;

export const DraftToReview: Story = {};
/** The approval sheet: the exact terms, what stays the member's and what approving records. */
export const Approve: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(canvasElement.querySelector<HTMLElement>('[data-act="review"]')!);
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("dialog")
    ).toBeInTheDocument();
  },
};
export const ApprovedSetupPending: Story = { args: { record: issuerStoryDraftRecord("approved") } };
export const DraftChanged: Story = { args: { record: issuerStoryDraftRecord("changed") } };
export const Declined: Story = { args: { record: issuerStoryDraftRecord("declined") } };
export const SigningNotAvailable: Story = { args: { canSign: false } };
