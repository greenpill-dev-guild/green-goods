import type { Meta, StoryObj } from "@storybook/react";
import { SeedlingIllustration } from "./SeedlingIllustration";

const meta: Meta<typeof SeedlingIllustration> = {
  title: "Admin/Shell/SeedlingIllustration",
  component: SeedlingIllustration,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Inline SVG with a seedling that sprouts, unfurls leaves, and reveals the top bud. Used on empty states and account-creation surfaces.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SeedlingIllustration>;

export const Default: Story = {
  args: { className: "h-40 w-40" },
};

export const Small: Story = {
  args: { className: "h-16 w-16" },
};

export const Large: Story = {
  args: { className: "h-64 w-64" },
};
