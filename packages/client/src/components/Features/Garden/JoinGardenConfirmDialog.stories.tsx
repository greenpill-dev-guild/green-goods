import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";
import { JoinGardenConfirmDialog } from "./JoinGardenConfirmDialog";

/**
 * The one-sentence confirmation before joining an open garden, used by the Profile gardens list and
 * the garden page. Join stacks over an outlined Cancel on phones and becomes a right-aligned row
 * from 640px (DL-016).
 */
const meta: Meta<typeof JoinGardenConfirmDialog> = {
  title: "Client/Sheets/JoinGardenConfirmDialog",
  component: JoinGardenConfirmDialog,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    isOpen: true,
    gardenName: "Green Goods Community Garden",
    isJoining: false,
    onClose: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof JoinGardenConfirmDialog>;

export const Default: Story = {
  play: async ({ args }) => {
    await expect(
      await screen.findByText(
        "You'll join Green Goods Community Garden as a Gardener and can submit work right away."
      )
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    await expect(args.onConfirm).toHaveBeenCalledOnce();
  },
};

export const Joining: Story = {
  args: { isJoining: true },
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Join" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};

export const LongGardenName: Story = {
  args: { gardenName: "Cooperativa Agroecológica das Ilhas de Abundância do Baixo Amazonas" },
  play: async () => {
    await expect(
      await screen.findByText(/Cooperativa Agroecológica das Ilhas de Abundância/)
    ).toBeVisible();
  },
};
