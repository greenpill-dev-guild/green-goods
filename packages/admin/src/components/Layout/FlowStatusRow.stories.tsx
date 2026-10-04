import type { Meta, StoryObj } from "@storybook/react";
import { FlowStatusRow } from "./FlowStatusRow";

const meta = {
  title: "Admin/Shell/FlowStatusRow",
  component: FlowStatusRow,
  tags: ["autodocs"],
  args: {
    tone: "neutral",
    title: "Creates 10 separate promises",
    description: "Each one is taken up, proven and confirmed on its own.",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl rounded-xl border border-stroke-soft bg-bg-white p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The one status line a sending flow changes while it works (PRD-1022 D7, D16). It keeps " +
          "one height through ready, approving, declined, created, sending and partial, so the " +
          "review under it never moves: only its tone and words change, and the words carry the " +
          "tone for anyone who cannot see it. A wallet that asks once per promise adds a thin " +
          "progress bar. With summary rows it is the single summary at the top of a sending dialog.",
      },
    },
  },
} satisfies Meta<typeof FlowStatusRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Approving: Story = {
  args: {
    tone: "info",
    busy: true,
    title: "Approve in your wallet: 10 promises in one request",
    description: "They are created together: all 10, or none if the wallet declines.",
  },
};

/** A wallet that can't bundle: one prompt per promise, counted, with a thin bar. */
export const OnePromptEach: Story = {
  args: {
    tone: "info",
    busy: true,
    progress: 20,
    title: "Confirm in your wallet (3 of 10)",
    description:
      "2 created so far. This wallet asks once per promise; declining one skips only that one.",
  },
};

export const Declined: Story = {
  args: {
    tone: "error",
    title: "Nothing was created",
    description:
      "Your wallet declined the request. Your answers are still here, and Try Again asks once more.",
  },
};

export const Partial: Story = {
  args: {
    tone: "warning",
    progress: 70,
    title: "7 created · 2 didn't send · 1 waits",
    description:
      "Try Again (2) sends only the ones that didn't send, with the same answers and deadline. The one that waits is on the Promises tab.",
  },
};

export const Created: Story = {
  args: {
    tone: "success",
    title: "10 promises created",
    description: "Gardeners can take them up now. They show as one group on the Promises tab.",
  },
};

/** The single summary of a sending dialog: status lines first, then rows that stay put. */
export const WithSummary: Story = {
  args: {
    tone: "info",
    busy: true,
    title: "Approve all 5 in one request",
    description: "Your wallet adds them together: all 5, or none if it declines.",
    summary: [
      ["Group", "Household water survey"],
      ["Adding", "5 promises"],
      ["Due", "Wed, Oct 14, 2026, 5:00 PM UTC"],
    ],
  },
};
