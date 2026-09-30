import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { PoolNotReadyCard } from "./PoolNotReadyCard";

const meta: Meta<typeof PoolNotReadyCard> = {
  title: "Admin/Pool/PoolNotReadyCard",
  component: PoolNotReadyCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The pool tab before the pool takes commitments: what setting up gives the garden, and Set Up Commitments. Offline the act waits and says why beneath it.",
      },
    },
  },
  args: { isOnline: true, onSetUp: () => undefined },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolNotReadyCard>;

export const Online: Story = {};

/** Set Up waits for a connection and says so. */
export const Offline: Story = {
  args: { isOnline: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Set Up Commitments" })).toBeDisabled();
    await expect(canvas.getByRole("status")).toHaveTextContent(/needs a connection/i);
  },
};
