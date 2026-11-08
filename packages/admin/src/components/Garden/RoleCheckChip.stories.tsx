import esMessages from "@green-goods/shared/i18n/es.json";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { expect, fn, userEvent, within } from "storybook/test";
import { LockedRoleChip, RoleCheckChip } from "./RoleCheckChip";

const meta: Meta<typeof RoleCheckChip> = {
  title: "Admin/Workflows/Garden/RoleCheckChip",
  component: RoleCheckChip,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "One role on a Manage Roles row, as a checkbox: checked picks that person-and-role pair for removal. A filled box and a heavier outline mark it, never color alone. A role the viewer cannot remove is the locked chip, which is not focusable; its row says why.",
      },
    },
  },
  args: {
    role: "evaluator",
    personName: "chidinma",
    checked: false,
    onCheckedChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RoleCheckChip>;

export const Unchecked: Story = {};

export const Checked: Story = { args: { checked: true } };

/** While another write runs, the chips wait. */
export const Disabled: Story = { args: { disabled: true } };

function Toggle({ role }: { role: GardenRole }) {
  const [checked, setChecked] = useState(false);
  return (
    <RoleCheckChip
      role={role}
      personName="tomi.eth"
      checked={checked}
      onCheckedChange={setChecked}
    />
  );
}

/** Every role, with the lock beside them: Space toggles a focused chip. */
export const AllRoles: Story = {
  render: () => (
    <div className="flex flex-wrap gap-1.5">
      <LockedRoleChip role="owner" />
      <LockedRoleChip role="steward" />
      <Toggle role="evaluator" />
      <Toggle role="gardener" />
      <Toggle role="funder" />
      <Toggle role="community" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const evaluator = canvas.getByRole("checkbox", { name: "Remove Evaluator from tomi.eth" });
    evaluator.focus();
    await userEvent.keyboard(" ");
    await expect(evaluator).toBeChecked();
    await expect(canvas.queryByRole("checkbox", { name: /Owner/ })).toBeNull();
  },
};

/** The longest role name, Spanish "Miembro de la comunidad", stays on one line. */
export const SpanishLongestRole: Story = {
  args: { role: "community", checked: true },
  decorators: [
    (Story) => (
      <IntlProvider locale="es" messages={esMessages}>
        <Story />
      </IntlProvider>
    ),
  ],
};
