import type { Meta, StoryObj } from "@storybook/react";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["transparent", "pill", "outline"],
      description: "Visual variant of the badge",
    },
    tint: {
      control: "select",
      options: ["primary", "secondary", "tertiary", "accent", "destructive", "black", "muted", "none"],
      description: "Color tint of the badge",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Badge",
    variant: "transparent",
    tint: "none",
  },
};

export const Pill: Story = {
  args: {
    children: "Pill Badge",
    variant: "pill",
    tint: "primary",
  },
};

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};

export const WithLeadingIcon: Story = {
  args: {
    children: "Success",
    variant: "pill",
    tint: "primary",
    leadingIcon: <RiCheckLine className="w-4 h-4" />,
  },
};

export const WithTrailingIcon: Story = {
  args: {
    children: "Dismiss",
    variant: "pill",
    tint: "destructive",
    trailingIcon: <RiCloseLine className="w-4 h-4" />,
  },
};

export const AllTints: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="pill" tint="primary">Primary</Badge>
      <Badge variant="pill" tint="secondary">Secondary</Badge>
      <Badge variant="pill" tint="tertiary">Tertiary</Badge>
      <Badge variant="pill" tint="accent">Accent</Badge>
      <Badge variant="pill" tint="destructive">Destructive</Badge>
      <Badge variant="pill" tint="black">Black</Badge>
      <Badge variant="pill" tint="muted">Muted</Badge>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="transparent">Transparent</Badge>
      <Badge variant="pill" tint="primary">Pill</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
