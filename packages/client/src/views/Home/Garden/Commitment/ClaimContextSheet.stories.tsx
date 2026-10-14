import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";
import { ClaimContextSheet } from "./ClaimContextSheet";

const MEMBER_GARDEN = {
  address: "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address,
  name: "Green Goods Community Garden",
};
const STEWARDED_GARDEN = {
  address: "0x35722eedf3f7566a23fa871f0a04267aee78e0db" as Address,
  name: "Nigeria Farmers Collective",
};

/**
 * Choosing who takes up a protocol-pool commitment: yourself through a garden you belong to, or a
 * garden you steward. Open commitments say Take This Up; steward-reviewed ones ask. The choice and
 * Cancel sit in the shared bar (DL-016).
 */
const meta: Meta<typeof ClaimContextSheet> = {
  title: "Client/Commitments/ClaimContextSheet",
  component: ClaimContextSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    open: true,
    onOpenChange: fn(),
    memberGardens: [MEMBER_GARDEN],
    stewardedGardens: [STEWARDED_GARDEN],
    approvalGated: false,
    isPending: false,
    onContinue: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ClaimContextSheet>;

export const TakeUp: Story = {
  play: async ({ args }) => {
    const takeUp = await screen.findByRole("button", { name: "Take This Up" });
    await userEvent.click(screen.getByRole("radio", { name: /For Nigeria Farmers Collective/ }));
    await userEvent.click(takeUp);
    await expect(args.onContinue).toHaveBeenCalledWith({
      kind: "garden",
      garden: STEWARDED_GARDEN.address,
    });
  },
};

export const AskToTakeUp: Story = {
  args: { approvalGated: true },
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Ask to take this up" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  },
};

export const NoGardenToClaimThrough: Story = {
  args: { memberGardens: [], stewardedGardens: [] },
  play: async () => {
    await expect(
      await screen.findByText("You are not a member of a garden that could take this up.")
    ).toBeVisible();
    await expect(screen.getByRole("button", { name: "Take This Up" })).toBeDisabled();
  },
};

export const TakingUp: Story = {
  args: { isPending: true },
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Take This Up" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
    await expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  },
};
