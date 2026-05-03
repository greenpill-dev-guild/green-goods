import type { Meta, StoryObj } from "@storybook/react";
import { ConvictionMeter } from "./ConvictionMeter";

const meta: Meta<typeof ConvictionMeter> = {
  title: "Admin/Conviction/ConvictionMeter",
  component: ConvictionMeter,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Single-bar conviction visualisation with threshold tick + accrual rate + ETA. " +
          "Spec: design_handoff_admin-revamp/screens/UI Review.html § 03. " +
          "Decay UI deferred per audit §5.4.2 — ships without the ghost trailing fill in v1.",
      },
    },
  },
  argTypes: {
    conviction: { control: { type: "range", min: 0, max: 100, step: 1 } },
    threshold: { control: { type: "range", min: 0, max: 100, step: 1 } },
    dailyAccrual: { control: { type: "range", min: 0, max: 10, step: 0.1 } },
    status: {
      control: { type: "select" },
      options: ["accruing", "passing", "funded", "withdrawn", "expired"],
    },
    showLabels: { control: "boolean" },
  },
  args: {
    showLabels: true,
  },
};

export default meta;
type Story = StoryObj<typeof ConvictionMeter>;

export const Accruing: Story = {
  args: {
    conviction: 64,
    threshold: 75,
    dailyAccrual: 3.2,
    status: "accruing",
  },
};

export const NearThreshold: Story = {
  args: {
    conviction: 72,
    threshold: 75,
    dailyAccrual: 1.4,
    status: "accruing",
  },
  parameters: {
    docs: {
      description: {
        story: "Within 5% of crossing — threshold tick pulses to telegraph 'almost there'.",
      },
    },
  },
};

export const Passing: Story = {
  args: {
    conviction: 82,
    threshold: 75,
    dailyAccrual: 1.4,
    status: "passing",
  },
};

export const Funded: Story = {
  args: {
    conviction: 100,
    threshold: 75,
    dailyAccrual: 0,
    status: "funded",
  },
};

export const Withdrawn: Story = {
  args: {
    conviction: 28,
    threshold: 60,
    dailyAccrual: 0,
    status: "withdrawn",
  },
};

export const Expired: Story = {
  args: {
    conviction: 18,
    threshold: 60,
    dailyAccrual: 0,
    status: "expired",
  },
};

export const Stalled: Story = {
  args: {
    conviction: 32,
    threshold: 75,
    dailyAccrual: 0,
    status: "accruing",
  },
  parameters: {
    docs: {
      description: {
        story: "Accruing but no weight on the proposal — ETA reads 'stalled'.",
      },
    },
  },
};

export const NoLabels: Story = {
  args: {
    conviction: 64,
    threshold: 75,
    dailyAccrual: 3.2,
    status: "accruing",
    showLabels: false,
  },
};
