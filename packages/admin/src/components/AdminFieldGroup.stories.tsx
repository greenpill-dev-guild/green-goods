import type { Meta, StoryObj } from "@storybook/react";
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
          "Group-shaped member of the admin field family: fieldset+legend (or labelled div) with hint and error anatomy on the same tokens as AdminTextField, for checkbox grids, repeating-row editors, and upload wells.",
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
