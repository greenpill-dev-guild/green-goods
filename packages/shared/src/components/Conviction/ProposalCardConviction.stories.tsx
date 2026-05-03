import type { Meta, StoryObj } from "@storybook/react";
import type { ConvictionProposal } from "../../types/conviction";
import { ProposalCardConviction } from "./ProposalCardConviction";

const accruing: ConvictionProposal = {
  id: "PRP-024",
  title: "Compost program · Q3 expansion",
  summary:
    "Allocate 4,500 SEED to expand neighborhood composting routes from 6 to 14 over the season.",
  conviction: 64,
  threshold: 75,
  dailyAccrual: 3.2,
  supporters: 47,
  status: "accruing",
};

const passing: ConvictionProposal = {
  id: "PRP-025",
  title: "Solar microgrid · pilot block",
  summary: "Fund initial site survey and 6-panel install on the community center roof.",
  conviction: 82,
  threshold: 75,
  dailyAccrual: 1.4,
  supporters: 63,
  status: "passing",
};

const funded: ConvictionProposal = {
  id: "PRP-019",
  title: "Greywater filtration units (×3)",
  summary: "Pilot install at three high-traffic plots before season change.",
  conviction: 100,
  threshold: 60,
  dailyAccrual: 0,
  supporters: 32,
  status: "funded",
};

const expired: ConvictionProposal = {
  id: "PRP-014",
  title: "Drone aerial mapping rerun",
  summary: "Re-fly Q1 mapping to capture canopy growth deltas before the dry season.",
  conviction: 18,
  threshold: 60,
  dailyAccrual: 0,
  supporters: 4,
  status: "expired",
};

const meta: Meta<typeof ProposalCardConviction> = {
  title: "Admin/Conviction/ProposalCardConviction",
  component: ProposalCardConviction,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Card composition: status pill + supporters · title · summary · ConvictionMeter. " +
          "Replaces the v1 for/against/abstain TallyCard (which never existed in this codebase, " +
          "so this is a net-new component, not a migration).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProposalCardConviction>;

export const Accruing: Story = {
  args: { proposal: accruing },
};

export const Passing: Story = {
  args: { proposal: passing },
};

export const Funded: Story = {
  args: { proposal: funded },
};

export const Expired: Story = {
  args: { proposal: expired },
};

export const Interactive: Story = {
  args: {
    proposal: accruing,
    onClick: () => {
      // eslint-disable-next-line no-console
      console.log("ProposalCardConviction clicked");
    },
  },
  parameters: {
    docs: {
      description: {
        story: "When `onClick` is provided, the card renders as a button with hover/focus styling.",
      },
    },
  },
};
