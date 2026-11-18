import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { FundingHistory } from "./FundingHistory";
import { buildScenario } from "./scenarios";
import { defaultScope } from "./scope";

const compost = buildScenario("compost");
const learning = buildScenario("learning");
const partial = buildScenario("partial");
const empty = buildScenario("new-garden");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/FundingHistory",
  component: FundingHistory,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interface 7 (proposed). Balances per asset and account, each with its own step line; deposits, yield shares, claims and allocations stay distinct, and an allocation moves nothing. No exchange rates, no single total, no runway, no link from approval to payment. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: { dataset: compost, scope: { ...defaultScope(compost, "funding"), month: "2025-12" } },
} satisfies Meta<typeof FundingHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two assets, an endowment and a cookie jar, with December's allocation as a plan. */
export const TwoAssets: Story = {};

export const JarOnly: Story = {
  args: { dataset: learning, scope: defaultScope(learning, "funding") },
};

export const OneEntryUnread: Story = {
  args: { dataset: partial, scope: defaultScope(partial, "funding") },
};

export const NothingRecorded: Story = {
  args: { dataset: empty, scope: defaultScope(empty, "funding") },
};
