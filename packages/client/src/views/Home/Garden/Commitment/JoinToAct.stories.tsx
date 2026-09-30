import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { JoinToActCard } from "./JoinToAct";

/**
 * What a signed-in reader who does not belong to the garden sees under the status band in place
 * of an act bar: one sentence and one door. Join outright when the garden is open to join, ask a
 * steward when it is not, and find a garden first on the protocol pool.
 */
const meta: Meta<typeof JoinToActCard> = {
  title: "Client/Commitments/JoinToAct",
  component: JoinToActCard,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "padded" },
  globals: { viewport: { value: "mobile" } },
  args: {
    mode: "join",
    gardenName: "Green Goods Community Garden",
    isBusy: false,
    disabled: false,
    onAct: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof JoinToActCard>;

export const OpenToJoin: Story = {};

export const Joining: Story = {
  args: { isBusy: true },
};

export const Offline: Story = {
  args: { disabled: true },
};

export const StewardLetsYouIn: Story = {
  args: { mode: "request", gardenName: "Nigeria Farmers Collective" },
};

export const ProtocolPool: Story = {
  args: { mode: "find", gardenName: null },
};
