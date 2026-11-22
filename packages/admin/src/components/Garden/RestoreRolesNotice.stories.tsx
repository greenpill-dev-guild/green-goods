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
          "Names the roles a person's Owner or Steward role gives but they lack, and restores them in one action. The chain is read first, so the wallet is asked only for roles still missing (PRD-979).",
      },
    },
  },
  args: {
    address: MEMBER,
    roles: ["steward", "gardener"],
    recordedRoles: ["steward", "gardener"],
    check: fn(async () => ["owner" as const, "evaluator" as const]),
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
    check: fn(async () => ["gardener" as const]),
  },
};

/** The indexed list lagged the chain: nothing is sent, and the row says so. */
export const NothingMissingOnChain: Story = {
  args: { check: fn(async () => ["owner" as const]) },
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

/** A viewer who cannot grant a missing role is pointed to an owner instead. */
export const ViewerCannotRestore: Story = {
  args: { roles: ["owner"], recordedRoles: ["owner"], allowedRoles: ["steward"] },
};
