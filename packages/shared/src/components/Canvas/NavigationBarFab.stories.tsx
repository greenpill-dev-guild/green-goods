import { RiAddLine, RiHandCoinLine, RiLeafLine, RiUserAddLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { FabConfig } from "./NavigationBar";
import { FabButton } from "./NavigationBarFab";

const communityActions: FabConfig = {
  icon: RiAddLine,
  label: "Community actions",
  actions: [
    {
      id: "add-member",
      icon: RiUserAddLine,
      label: "Add Member",
      labelId: "cockpit.community.action.addMember",
    },
    {
      id: "fund-payout-jar",
      icon: RiHandCoinLine,
      label: "Fund Cookie Jar",
      labelId: "cockpit.community.action.fundPayoutJar",
      disabled: true,
      disabledReasonId: "cockpit.community.action.fundPayoutJarNoJar",
      disabledReason: "This garden has no payout jar yet.",
    },
  ],
  onAction: fn(),
};

const meta = {
  title: "Shared/Canvas/NavigationBarFab",
  component: FabButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The shared navigation bar's floating action button and speed dial, as non-admin surfaces render it. Admin renders its own fork in `components/Shell/FabButton`.",
      },
    },
  },
  args: { config: communityActions, mobileFloating: true },
} satisfies Meta<typeof FabButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Several actions open a speed dial; a disabled one says why. */
export const SpeedDial: Story = {};

/** One action fires directly, labelled on the floating pill. */
export const SingleAction: Story = {
  args: {
    config: {
      icon: RiLeafLine,
      label: "Create",
      actions: [
        {
          id: "submit-work",
          icon: RiLeafLine,
          label: "Submit Work",
          labelId: "app.admin.work.submitWork",
        },
      ],
      onAction: fn(),
    },
  },
};
