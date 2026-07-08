import { RiMailLine, RiSearchLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminTextField } from "./AdminTextField";

const meta: Meta<typeof AdminTextField> = {
  title: "Admin/Primitives/AdminTextField",
  component: AdminTextField,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 text field with filled and outlined variants, 56dp container, floating label, active indicator or outline, icon slots, supporting text, error, and disabled states.",
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: ["filled", "outlined"] },
    required: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminTextField>;

export const Filled: Story = {
  args: { label: "Garden name", variant: "filled" },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const Outlined: Story = {
  args: { label: "Garden name", variant: "outlined" },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const WithLeadingIcon: Story = {
  args: {
    label: "Search",
    variant: "outlined",
    leadingIcon: RiSearchLine,
    placeholder: "Search gardens",
  },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const Error: Story = {
  args: {
    label: "Email address",
    variant: "filled",
    defaultValue: "not-an-email",
    error: "Enter a valid email address.",
    leadingIcon: RiMailLine,
  },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
      <AdminTextField label="Filled empty" variant="filled" />
      <AdminTextField label="Outlined empty" variant="outlined" />
      <AdminTextField label="Filled value" variant="filled" defaultValue="North Meadow" />
      <AdminTextField label="Outlined value" variant="outlined" defaultValue="North Meadow" />
      <AdminTextField
        label="Email address"
        variant="filled"
        helperText="Used for garden invitations."
        leadingIcon={RiMailLine}
      />
      <AdminTextField
        label="Invalid email"
        variant="filled"
        defaultValue="not-an-email"
        error="Enter a valid email address."
        leadingIcon={RiMailLine}
      />
      <AdminTextField label="Chain ID" variant="outlined" defaultValue="11155111" disabled />
      <AdminTextField label="Required field" variant="outlined" required />
    </div>
  ),
};

export const OutlinedAtSectionTop: Story = {
  render: () => (
    <section className="max-w-sm overflow-hidden rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] p-0">
      <AdminTextField
        label="Long campaign operator payout token label"
        variant="outlined"
        defaultValue="0.25"
      />
      <div className="px-3 pb-3 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
        Focused and prefilled outlined labels reserve their own top label space.
      </div>
    </section>
  ),
};

const WORKSPACE_TONES = [
  ["hub", "Hub"],
  ["garden", "Garden"],
  ["community", "Community"],
  ["actions", "Actions"],
] as const;

const TextFieldToneMatrix = ({ theme }: { theme: "light" | "dark" }) => (
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
          className="space-y-3 rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-low))] p-3"
        >
          <div className="text-label-md font-medium text-[rgb(var(--m3-on-surface-variant))]">
            {label}
          </div>
          <AdminTextField
            label={`${theme} ${label} filled`}
            variant="filled"
            defaultValue="North Meadow"
            helperText="Focus shows the workspace accent line."
          />
          <AdminTextField
            label={`${theme} ${label} outlined`}
            variant="outlined"
            defaultValue="North Meadow"
            helperText="Focus shows the workspace accent ring."
          />
        </div>
      ))}
    </div>
  </section>
);

export const WorkspaceToneMatrix: Story = {
  render: () => (
    <div className="space-y-4">
      <TextFieldToneMatrix theme="light" />
      <TextFieldToneMatrix theme="dark" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actionsField = canvas.getByRole("textbox", { name: "dark Actions outlined" });
    await userEvent.click(actionsField);
    await expect(actionsField).toHaveFocus();
  },
};
