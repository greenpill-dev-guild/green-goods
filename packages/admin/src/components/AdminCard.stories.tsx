import { RiArrowRightSLine, RiLeafLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminCard } from "./AdminCard";

const meta: Meta<typeof AdminCard> = {
  title: "Admin/Primitives/AdminCard",
  component: AdminCard,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 card with filled, elevated, and outlined variants. Interactive cards add an M3 state layer and elevation response.",
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
  <div className="flex items-start gap-3">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--m3-shape-full)] bg-[rgb(var(--m3-primary-container))] text-[rgb(var(--m3-on-primary-container))]">
      <RiLeafLine className="h-5 w-5" aria-hidden />
    </span>
    <div className="min-w-0 flex-1 space-y-1">
      <div className="text-title-sm text-[rgb(var(--m3-on-surface))]">Pending review</div>
      <div className="text-body-md text-[rgb(var(--m3-on-surface-variant))]">
        14 submissions waiting, oldest 3 days.
      </div>
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
      <div className="flex items-center justify-between gap-4">
        <SampleContent />
        <RiArrowRightSLine
          className="h-6 w-6 shrink-0 text-[rgb(var(--m3-on-surface-variant))]"
          aria-hidden
        />
      </div>
    </AdminCard>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-3">
      {(["filled", "elevated", "outlined"] as const).map((variant) => (
        <AdminCard key={variant} variant={variant}>
          <div className="space-y-2">
            <div className="text-label-lg capitalize text-[rgb(var(--m3-on-surface))]">
              {variant}
            </div>
            <div className="text-body-md text-[rgb(var(--m3-on-surface-variant))]">
              Surface, shape, and elevation remain visible inside the admin canvas.
            </div>
          </div>
        </AdminCard>
      ))}
    </div>
  ),
};
