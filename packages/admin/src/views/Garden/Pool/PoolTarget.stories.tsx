import type { Meta, StoryObj } from "@storybook/react";
import { PoolTarget } from "./PoolTarget";

const meta: Meta<typeof PoolTarget> = {
  title: "Admin/Pool/PoolTarget",
  component: PoolTarget,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Names the pool a dialog's writes land on, first thing in every pool dialog. The protocol pool is set apart on purpose, so a change there never reads as a change to one garden's pool.",
      },
    },
  },
  args: { target: { gardenName: "Aiyeloja Family Garden", isProtocol: false } },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolTarget>;

/** A garden's own pool. */
export const GardenPool: Story = {};

/** The protocol pool, set apart from every garden's. */
export const ProtocolPool: Story = {
  args: { target: { gardenName: "Green Goods Community Garden", isProtocol: true } },
};

/** A long garden name truncates on one line; the full name stays in the tooltip. */
export const LongGardenName: Story = {
  args: {
    target: {
      gardenName: "Cooperativa Agroecológica de Mujeres Rurales del Valle de Tenza",
      isProtocol: false,
    },
  },
};
