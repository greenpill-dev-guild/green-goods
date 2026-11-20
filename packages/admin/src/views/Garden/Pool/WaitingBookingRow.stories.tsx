import { Button } from "@green-goods/shared/components/Button";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";
import { WaitingBookingRow } from "./WaitingBookingRow";
import { nameVoucherMembers, STORY_LINA_ENDED, STORY_MARA_VISITED } from "./poolStoryVouchers";

const NOW_MS = STORYBOOK_NOW_SECONDS * 1000;
const VISIT_TAG = {
  tag: { label: "Visit to report", tone: "warning" as const },
  detail: "Visited yesterday · 1 voucher held",
};

const meta: Meta<typeof WaitingBookingRow> = {
  title: "Admin/Pool/WaitingBookingRow",
  component: WaitingBookingRow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A voucher booking under way in Review Promises, on an ask's own row: who holds it and, for a visit, its day; the act it waits for on the right; its pill and line across the row. Once the act goes out from the row, the row keeps its outcome for the visit (DL-067). People and dates are fictional.",
      },
    },
  },
  args: {
    booking: STORY_MARA_VISITED,
    title: "Hub day, up to 4 hours",
    isNew: false,
    nowMs: NOW_MS,
    state: {
      status: "waiting",
      act: (
        <Button type="button" emphasis="primary" size="compact">
          Report Visit…
        </Button>
      ),
    },
    tagFor: () => VISIT_TAG,
    onOpen: () => undefined,
  },
  beforeEach: nameVoucherMembers,
  decorators: [
    (Story) => (
      <ul className="max-w-md divide-y divide-stroke-soft p-4" data-tone="garden">
        <Story />
      </ul>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WaitingBookingRow>;

/** Mara's hub day was yesterday: her visit waits for its report. */
export const VisitToReport: Story = {
  play: async ({ canvasElement }) => {
    const row = within(canvasElement);
    await expect(await row.findByText("Mara")).toBeVisible();
    await expect(row.getByText("Visit to report")).toBeVisible();
  },
};

/** Arrived after the visit's first read: marked New. */
export const New: Story = { args: { isNew: true } };

/** Reported from this row: the outcome stays for the visit, and the line says who it waits on. */
export const Reported: Story = {
  args: {
    state: { status: "done", label: "Reported", at: NOW_MS },
    tagFor: (name) => ({
      tag: { label: `Waiting for ${name} to confirm`, tone: "neutral" },
      detail: "4 of 4 hours reported",
    }),
  },
};

/** Settled elsewhere while the steward looked: no act, and no line. */
export const NoLongerWaiting: Story = {
  args: { booking: STORY_LINA_ENDED, state: { status: "gone" } },
};
