import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { VoucherRowAct } from "./VoucherRowAct";
import { STORY_LINA_ENDED, STORY_MARA_VISITED } from "./poolStoryVouchers";

const meta: Meta<typeof VoucherRowAct> = {
  title: "Admin/Pool/VoucherRowAct",
  component: VoucherRowAct,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A booking's one act in its Review Promises row (PRD-1297 surface 6, `SIssuer`), where Approve… and Accept… sit on an ask's row: Report Visit… and Propose Return… open their dialogs; Retry Transfer sends the same transfer again in one tap, since anyone may and it can't be sent twice.",
      },
    },
  },
  args: {
    booking: STORY_MARA_VISITED,
    act: "report",
    disabled: false,
    onOpen: () => undefined,
    onRetry: async () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VoucherRowAct>;

/** A hub day that has happened: report the visit. */
export const ReportVisit: Story = {};

/** Claude access that ended early: propose what comes back. */
export const ProposeReturn: Story = {
  args: { booking: STORY_LINA_ENDED, act: "propose" },
};

/** A return that didn't go through: retry the same transfer, in one tap. */
export const RetryTransfer: Story = {
  args: { booking: STORY_LINA_ENDED, act: "retry" },
};

/** The retry is with the chain: the button holds until it lands. */
export const Retrying: Story = {
  args: { booking: STORY_LINA_ENDED, act: "retry", onRetry: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: /Retry Transfer/ });
    await userEvent.click(button);
    // A loading button stays focusable: busy, and refusing a second tap.
    await expect(button).toHaveAttribute("aria-busy", "true");
  },
};

/** Offline, or another act is with the wallet: the act waits. */
export const Disabled: Story = {
  args: { disabled: true },
};
