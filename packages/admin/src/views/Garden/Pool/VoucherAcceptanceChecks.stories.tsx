import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";
import { VoucherAcceptanceChecks } from "./VoucherAcceptanceChecks";
import { STORY_KWESI_ASK } from "./poolStoryVouchers";

const ALL_HOLD = { consent: true, approval: true, deposit: true, deadline: true, ready: true };

const meta: Meta<typeof VoucherAcceptanceChecks> = {
  title: "Admin/Pool/VoucherAcceptanceChecks",
  component: VoucherAcceptanceChecks,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The four checks in a voucher booking's Accept dialog (PRD-1297 surface 6): the member's current consent, the issuer Safe's approval, the confirmed deposit and the deadline, the ones `acceptServiceClaim` enforces. Each says whether it holds by its mark and its words, never by color alone, and a failing one says what is missing.",
      },
    },
  },
  args: {
    ask: STORY_KWESI_ASK,
    name: "Kwesi",
    checks: ALL_HOLD,
    nowMs: STORYBOOK_NOW_SECONDS * 1000,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VoucherAcceptanceChecks>;

/** Every check holds: the steward can accept. */
export const AllHold: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByTestId("voucher-acceptance-checks");
    await expect(list.querySelectorAll('[data-holds="true"]')).toHaveLength(4);
  },
};

/** The deposit hasn't reached Green Goods yet. */
export const DepositNotConfirmed: Story = {
  args: { checks: { ...ALL_HOLD, deposit: false, ready: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Not confirmed on Green Goods yet")).toBeVisible();
  },
};

/** The offer changed after Kwesi agreed, and the deadline passed: two checks fail. */
export const TermsChangedAndLate: Story = {
  args: {
    checks: { ...ALL_HOLD, consent: false, deadline: false, ready: false },
    nowMs: (STORY_KWESI_ASK.setup!.acceptBy + 86_400) * 1000,
  },
};
