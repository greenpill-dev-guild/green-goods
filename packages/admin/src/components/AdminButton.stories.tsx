import { RiAddLine, RiArrowRightLine, RiDeleteBinLine, RiSave3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { drawnRings } from "../../../shared/.storybook/design-system/measure";
import { AdminButton, AdminIconButton } from "./AdminButton";

const meta: Meta<typeof AdminButton> = {
  title: "Admin/Primitives/AdminButton",
  component: AdminButton,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 common button with filled, tonal, elevated, outlined, text, danger, and outlined danger variants. Uses full-round shape, label-large typography, M3 state layers, and tokenized spring motion.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["filled", "tonal", "elevated", "outlined", "text", "danger", "outlinedDanger"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminButton>;

export const Filled: Story = {
  args: { variant: "filled", size: "md", children: "Continue" },
};

export const Tonal: Story = {
  args: { variant: "tonal", size: "md", children: "Save draft" },
};

export const Outlined: Story = {
  args: { variant: "outlined", size: "md", children: "Cancel" },
};

/** A destructive action at outlined emphasis, beside a filled primary (Reject next to Approve). */
export const OutlinedDanger: Story = {
  args: { variant: "outlinedDanger", size: "md", children: "Reject" },
};

export const WithIcon: Story = {
  args: {
    variant: "filled",
    size: "md",
    leadingIcon: <RiAddLine />,
    children: "New action",
  },
};

export const Loading: Story = {
  args: { variant: "filled", loading: true, children: "Submitting" },
};

/**
 * AdminIconButton — glyph-only actions on the same DL-011 tiers (28/32/40).
 * The `label` prop is the mandatory accessible name (aria-label + tooltip).
 */
export const IconButtons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <AdminIconButton size="sm" label="Add (sm)">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton size="md" label="Add (md)">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton size="lg" label="Add (lg)">
          <RiAddLine />
        </AdminIconButton>
      </div>
      <div className="flex items-center gap-2">
        <AdminIconButton variant="standard" label="Standard">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton variant="accent" label="Accent">
          <RiArrowRightLine />
        </AdminIconButton>
        <AdminIconButton variant="tonal" label="Tonal">
          <RiSave3Line />
        </AdminIconButton>
        <AdminIconButton variant="filled" label="Filled">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton variant="danger" label="Delete">
          <RiDeleteBinLine />
        </AdminIconButton>
        <AdminIconButton label="Disabled" disabled>
          <RiAddLine />
        </AdminIconButton>
      </div>
    </div>
  ),
};

/**
 * Keyboard focus draws the ring on every low-emphasis variant. These rest at
 * elevation 0, which shares one box-shadow list with the ring; while that token
 * was `none` it voided the list and no ring drew. The play test tabs through them.
 */
export const FocusRings: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <AdminButton variant="tonal">Tonal</AdminButton>
      <AdminButton variant="outlined">Outlined</AdminButton>
      <AdminButton variant="text">Text</AdminButton>
      <AdminButton variant="danger">Danger</AdminButton>
      <AdminButton variant="outlinedDanger">Outlined danger</AdminButton>
      <AdminIconButton variant="tonal" label="Add item">
        <RiAddLine />
      </AdminIconButton>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const control of within(canvasElement).getAllByRole("button")) {
      await userEvent.tab();
      await expect(control).toHaveFocus();
      await waitFor(() => expect(drawnRings(control)).not.toHaveLength(0));
    }
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <AdminButton variant="filled" leadingIcon={<RiSave3Line />}>
          Filled
        </AdminButton>
        <AdminButton variant="tonal">Tonal</AdminButton>
        <AdminButton variant="elevated">Elevated</AdminButton>
        <AdminButton variant="outlined">Outlined</AdminButton>
        <AdminButton variant="text" leadingIcon={<RiArrowRightLine />}>
          Text
        </AdminButton>
        <AdminButton variant="danger" leadingIcon={<RiDeleteBinLine />}>
          Danger
        </AdminButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AdminButton disabled>Disabled</AdminButton>
        <AdminButton loading>Saving</AdminButton>
        <AdminButton variant="outlined" disabled>
          Disabled outline
        </AdminButton>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <AdminButton size="sm">Small</AdminButton>
        <AdminButton size="md">Medium</AdminButton>
        <AdminButton size="lg">Large</AdminButton>
      </div>
    </div>
  ),
};

const WORKSPACE_TONES = [
  ["hub", "Hub"],
  ["garden", "Garden"],
  ["community", "Community"],
  ["actions", "Actions"],
] as const;

const ButtonToneMatrix = ({ theme }: { theme: "light" | "dark" }) => (
  <section
    data-theme={theme}
    className="admin-m3 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-4"
  >
    <div className="mb-3 text-label-md font-semibold uppercase text-[rgb(var(--m3-on-surface-variant))]">
      {theme}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {WORKSPACE_TONES.map(([tone, label]) => (
        <div
          key={`${theme}-${tone}`}
          data-tone={tone}
          className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-low))] p-3"
        >
          <div className="mb-2 text-label-md font-medium text-[rgb(var(--m3-on-surface-variant))]">
            {label}
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="filled" size="sm" leadingIcon={<RiSave3Line />}>
              Filled
            </AdminButton>
            <AdminButton variant="tonal" size="sm">
              Tonal
            </AdminButton>
            <AdminButton variant="elevated" size="sm">
              Elevated
            </AdminButton>
            <AdminButton variant="outlined" size="sm">
              Outlined
            </AdminButton>
            <AdminButton variant="text" size="sm" leadingIcon={<RiArrowRightLine />}>
              Text
            </AdminButton>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export const WorkspaceToneMatrix: Story = {
  render: () => (
    <div className="space-y-4">
      <ButtonToneMatrix theme="light" />
      <ButtonToneMatrix theme="dark" />
    </div>
  ),
};
