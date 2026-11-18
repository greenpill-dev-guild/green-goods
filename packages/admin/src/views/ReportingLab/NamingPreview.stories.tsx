import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { NamingPreview } from "./NamingPreview";

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/NamingPreview",
  component: NamingPreview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The chosen Green Goods Hub and Review names, in the places a steward meets them (DL-182, DL-184). Reporting remains a prototype.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
} satisfies Meta<typeof NamingPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The chosen product name and its Review workspace. */
export const ChosenNames: Story = {};
