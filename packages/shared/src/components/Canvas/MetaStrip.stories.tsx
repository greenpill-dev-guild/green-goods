import type { Meta, StoryObj } from "@storybook/react";
import { MetaStrip } from "./MetaStrip";

const meta: Meta<typeof MetaStrip> = {
  title: "Canvas/MetaStrip",
  component: MetaStrip,
  tags: ["autodocs"],
  args: {
    items: [
      { id: "garden", label: "Garden", value: "Comunidad Verde" },
      { id: "updated", label: "Updated", value: "2h ago" },
      { id: "queue", label: "Submissions", value: "12" },
    ],
  },
  argTypes: {
    items: {
      control: "object",
      description: "Metadata pills rendered in order.",
    },
    className: {
      control: "text",
      description: "Additional classes for the strip wrapper.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof MetaStrip>;

export const Default: Story = {};

export const LabelsOnly: Story = {
  args: {
    items: [
      { id: "pending", label: "Pending review" },
      { id: "photos", label: "Photos attached" },
      { id: "field", label: "Field note" },
    ],
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};
