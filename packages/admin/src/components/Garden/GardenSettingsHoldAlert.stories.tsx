import { Domain } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { GardenSettingsHoldAlert } from "./GardenSettingsHoldAlert";

const HOLD = {
  operationIds: ["held-save"],
  fields: ["name", "description", "openJoining", "maxGardeners", "domains", "banner"],
  attempted: [],
  onChain: [
    { field: "name", value: "Tech and Sun" },
    {
      field: "description",
      value:
        "Community-driven restoration in the Atlantic Forest biome, with weekly workdays, a seed library, and a nursery run by the gardeners themselves.",
    },
    { field: "openJoining", value: true },
    { field: "maxGardeners", value: 0 },
    { field: "domains", value: [Domain.SOLAR, Domain.EDU] },
    { field: "banner", value: "" },
  ],
} satisfies Parameters<typeof GardenSettingsHoldAlert>[0]["hold"];

const meta: Meta<typeof GardenSettingsHoldAlert> = {
  title: "Admin/Workflows/Garden/GardenSettingsHoldAlert",
  component: GardenSettingsHoldAlert,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The alert at the top of Edit Garden when nobody can say yet whether a save landed, whether that was a moment ago or before a reload. It shows what the chain holds, so the person can decide with fresh values. The save's fields stay locked until they check again and it has landed, or they choose to move on.",
      },
    },
  },
  args: {
    hold: HOLD,
    isSettling: false,
    isSaving: false,
    onCheckAgain: () => undefined,
    onMoveOn: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof GardenSettingsHoldAlert>;

export const ChainValues: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("We couldn’t confirm your last save.")).toBeVisible();
    await expect(canvas.getByText("Name on chain: Tech and Sun")).toBeVisible();
    await expect(canvas.getByText("Domains on chain: Solar, Education")).toBeVisible();
  },
};

/** A read failed: the hold stands, and moving on waits until every value has been seen. */
export const SomeValuesUnread: Story = {
  args: { hold: { ...HOLD, onChain: HOLD.onChain.slice(0, 1) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Some values couldn’t be read just now. Check again to move on.")
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Move On" })).toBeDisabled();
  },
};

/** Check Again is reading the chain, and moving on waits for it. */
export const Checking: Story = {
  args: { isSettling: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Move On" })).toBeDisabled();
  },
};
