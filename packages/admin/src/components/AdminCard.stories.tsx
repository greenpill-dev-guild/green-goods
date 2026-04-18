import type { Meta, StoryObj } from "@storybook/react";
import { AdminCard } from "./AdminCard";

const meta: Meta<typeof AdminCard> = {
  title: "Admin/AdminCard",
  component: AdminCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 card with filled, elevated, and outlined variants. Corner-medium (12dp) shape. The interactive prop adds an M3 state layer + cursor pointer + hover elevation upgrade.",
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: ["filled", "elevated", "outlined"] },
    interactive: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminCard>;

const SampleContent = () => (
  <div className="space-y-1">
    <div className="text-label-md text-[rgb(var(--m3-on-surface))]">Queue — Pending review</div>
    <div className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
      14 submissions waiting · oldest 3 days
    </div>
  </div>
);

export const Elevated: Story = {
  args: { variant: "elevated", interactive: false },
  render: (args) => (
    <AdminCard {...args} className="max-w-sm">
      <SampleContent />
    </AdminCard>
  ),
};

export const Filled: Story = {
  args: { variant: "filled" },
  render: (args) => (
    <AdminCard {...args} className="max-w-sm">
      <SampleContent />
    </AdminCard>
  ),
};

export const Outlined: Story = {
  args: { variant: "outlined" },
  render: (args) => (
    <AdminCard {...args} className="max-w-sm">
      <SampleContent />
    </AdminCard>
  ),
};

export const Interactive: Story = {
  args: { variant: "elevated", interactive: true },
  render: (args) => (
    <AdminCard {...args} className="max-w-sm">
      <SampleContent />
    </AdminCard>
  ),
};

export const Gallery: Story = {
  render: () => (
    <div className="grid gap-3 sm:grid-cols-3">
      {(["filled", "elevated", "outlined"] as const).map((variant) => (
        <AdminCard key={variant} variant={variant}>
          <div className="space-y-1">
            <div className="text-label-sm uppercase tracking-wide text-[rgb(var(--m3-on-surface-variant))]">
              {variant}
            </div>
            <div className="text-label-md text-[rgb(var(--m3-on-surface))]">Sample card</div>
          </div>
        </AdminCard>
      ))}
    </div>
  ),
};
