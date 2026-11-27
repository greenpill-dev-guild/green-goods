import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { RestoreRolesNotice } from "./RestoreRolesNotice";

const MEMBER = "0x3333333333333333333333333333333333333333";

const meta: Meta<typeof RestoreRolesNotice> = {
  title: "Admin/Workflows/Garden/RestoreRolesNotice",
  component: RestoreRolesNotice,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "Names the roles a person's Owner or Steward role gives but they lack, and restores them in one action. The chain and the person's history are read again first, so the wallet is asked only for roles still missing and never recorded (PRD-979).",
      },
    },
  },
  args: {
    address: MEMBER,
    roles: ["steward", "gardener"],
    recordedRoles: ["steward", "gardener"],
    check: fn(async () => ({
      lacking: ["owner" as const, "evaluator" as const],
      recordedRoles: ["steward" as const, "gardener" as const],
    })),
    restore: fn(async () => true),
  },
};

export default meta;
type Story = StoryObj<typeof RestoreRolesNotice>;

/** A steward without the Evaluator hat their Steward grant gives. */
export const MissingEvaluator: Story = {};

/** An owner never misses Evaluator: the Owner grant gives Steward and Gardener only. */
export const OwnerMissingGardener: Story = {
  args: {
    roles: ["owner", "steward"],
    recordedRoles: ["owner", "steward"],
    check: fn(async () => ({
      lacking: ["gardener" as const],
      recordedRoles: ["owner" as const, "steward" as const],
    })),
  },
};

/** The indexed list lagged the chain: nothing is sent, and the row says so. */
export const NothingMissingOnChain: Story = {
  args: {
    check: fn(async () => ({
      lacking: ["owner" as const],
      recordedRoles: ["steward" as const, "gardener" as const],
    })),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Restore Evaluator" }));
    await expect(await canvas.findByRole("status")).toHaveTextContent("Nothing is missing.");
    await expect(args.restore).not.toHaveBeenCalled();
  },
};

/** This steward's Evaluator was granted once and taken away, so it is never offered back. */
export const DeliberateRemovalNotOffered: Story = {
  args: { recordedRoles: ["steward", "evaluator", "gardener"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.queryByText(/Missing/)).toBeNull();
  },
};

/** A viewer who cannot grant a missing role is pointed to an owner or steward instead. */
export const ViewerCannotRestore: Story = {
  args: { roles: ["owner"], recordedRoles: ["owner"], allowedRoles: ["steward"] },
};
