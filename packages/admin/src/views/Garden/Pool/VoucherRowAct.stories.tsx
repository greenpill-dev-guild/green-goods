import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { VoucherRowAct } from "./VoucherRowAct";
import { STORY_LINA_ENDED, STORY_MARA_VISIT } from "./poolStoryVouchers";

const meta: Meta<typeof VoucherRowAct> = {
  title: "Admin/Pool/VoucherRowAct",
  component: VoucherRowAct,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A booking's one act in its offer row's right slot in Offers and Requests (PRD-1297 surface 6, `SIssuer`): Report Visit… and Propose Return… open their dialogs, outlined like the list's other row acts; Retry Transfer sends the same transfer again in one tap, since anyone may and it can't be sent twice.",
      },
    },
  },
  args: {
    booking: STORY_MARA_VISIT,
    act: "report",
    disabled: false,
    onOpen: () => undefined,
    onRetry: async () => undefined,
  },
  decorators: [
    // The act reads its row's width, as it does in Offers and Requests.
    (Story) => (
      <div className="@container w-[560px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VoucherRowAct>;

/** A hub day under way: report the visit. */
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

/** Below 480px of row the act is its icon, named for screen readers and on hover. */
export const NarrowRow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-[320px]">
        <Story />
      </div>
    ),
  ],
};

/** Offline, or another act is with the wallet: the act waits. */
export const Disabled: Story = {
  args: { disabled: true },
};
