import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminCheckbox } from "./AdminCheckbox";
import { AdminFieldGroup } from "./AdminFieldGroup";
import { AdminTextField } from "./AdminTextField";

const meta: Meta<typeof AdminFieldGroup> = {
  title: "Admin/Primitives/AdminFieldGroup",
  component: AdminFieldGroup,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "Group-shaped member of the admin field family: fieldset+legend (or labeled div) in AdminTextField's anatomy (F3), the label above the content and the hint or error on the reserved message line under it, for checkbox grids, repeating-row editors, and upload wells.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminFieldGroup>;

export const CheckboxGrid: Story = {
  render: () => (
    <AdminFieldGroup
      label="Forms of capital"
      required
      hint="Select the forms of capital associated with this action"
      contentClassName="grid grid-cols-2 gap-2"
    >
      <AdminCheckbox checked label="Social" onChange={() => {}} />
      <AdminCheckbox checked={false} label="Material" onChange={() => {}} />
      <AdminCheckbox checked={false} label="Financial" onChange={() => {}} />
      <AdminCheckbox checked label="Living" onChange={() => {}} />
    </AdminFieldGroup>
  ),
};

export const RowEditor: Story = {
  render: () => (
    <AdminFieldGroup
      label="Required shot types"
      hint="Specify what types of photos users must capture"
      contentClassName="space-y-2"
    >
      <AdminTextField label="Shot #1" value="Front view" onChange={() => {}} />
      <AdminTextField label="Shot #2" value="Side view" onChange={() => {}} />
    </AdminFieldGroup>
  ),
};

export const ErrorState: Story = {
  render: () => (
    <AdminFieldGroup
      label="Forms of capital"
      required
      error="Select at least one form of capital"
      contentClassName="grid grid-cols-2 gap-2"
    >
      <AdminCheckbox checked={false} label="Social" onChange={() => {}} />
      <AdminCheckbox checked={false} label="Material" onChange={() => {}} />
    </AdminFieldGroup>
  ),
};

/**
 * The message line under a group is reserved like a field's, so a hint, or an
 * error arriving in its place, moves nothing below the group. Checked in browser
 * mode, where real layout applies; heights are compared with each other.
 */
export const MessageHoldsTheLine: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="grid max-w-3xl items-start gap-5 sm:grid-cols-3">
      <AdminFieldGroup label="No message" contentClassName="grid gap-2">
        <AdminCheckbox checked={false} label="Social" onChange={() => {}} />
      </AdminFieldGroup>
      <AdminFieldGroup label="Hint" hint="Pick at least one." contentClassName="grid gap-2">
        <AdminCheckbox checked={false} label="Social" onChange={() => {}} />
      </AdminFieldGroup>
      <AdminFieldGroup label="Error" error="Select at least one." contentClassName="grid gap-2">
        <AdminCheckbox checked={false} label="Social" onChange={() => {}} />
      </AdminFieldGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heightOf = (name: string) =>
      canvas.getByRole("group", { name }).getBoundingClientRect().height;
    const plain = heightOf("No message");
    await expect(Math.abs(heightOf("Hint") - plain)).toBeLessThan(0.5);
    await expect(Math.abs(heightOf("Error") - plain)).toBeLessThan(0.5);
  },
};
