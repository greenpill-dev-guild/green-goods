import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { HubShowOlder } from "./HubShowOlder";

const meta: Meta<typeof HubShowOlder> = {
  title: "Admin/Workflows/Hub/HubShowOlder",
  component: HubShowOlder,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The foot of a Hub list that holds only its garden's newest page: it reads the next page of older records, and its presence is what says the garden has more. While a page loads it stays on screen, busy, so a steward's focus is not dropped.",
      },
    },
  },
  args: {
    label: "Show Older Work",
    older: { onShowOlder: fn(), isLoading: false },
  },
};

export default meta;
type Story = StoryObj<typeof HubShowOlder>;

export const OlderWork: Story = {};

export const OlderHypercerts: Story = {
  args: { label: "Show Older Hypercerts" },
};

/** A page on its way: the button stays, busy, until the wider read lands. */
export const Loading: Story = {
  args: { older: { onShowOlder: fn(), isLoading: true } },
};
