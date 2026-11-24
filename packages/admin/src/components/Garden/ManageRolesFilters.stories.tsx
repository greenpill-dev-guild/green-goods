import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_PROFILE } from "../../../../shared/.storybook/fixtures";
import { ManageRolesFilters } from "./ManageRolesFilters";
import type { RoleFilter } from "./manageRoles";
import { CHIDI, manageRolesIdentity } from "./manageRolesStoryFixtures";

const meta: Meta<typeof ManageRolesFilters> = {
  title: "Admin/Workflows/Garden/ManageRolesFilters",
  component: ManageRolesFilters,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(manageRolesIdentity(FIXTURE_IMAGE_PROFILE)),
    (Story) => (
      <div className="@container max-w-2xl space-y-3">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "How a steward narrows Manage Roles: a search, the one person a directory row opened it for, and a role filter whose chips fold into one select below a 480px container (DL-141). None of them changes what is picked.",
      },
    },
  },
  args: {
    search: "",
    onSearchChange: fn(),
    scopedTo: null,
    onShowEveryone: fn(),
    roles: ["owner", "steward", "evaluator", "gardener", "community"],
    hasPicks: false,
    activeFilter: "all",
    onFilterChange: fn(),
    onShowPicked: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ManageRolesFilters>;

export const Everyone: Story = {};

/** With picks, a Selected filter joins the roles. */
export const WithPicks: Story = { args: { hasPicks: true, activeFilter: "selected" } };

/** Opened from one person's row: the list shows only them, and no filter reads as chosen. */
export const OpenedForOnePerson: Story = {
  args: { scopedTo: CHIDI as Address, scopedName: "chidinma.greengoods.eth" },
};

/** Four of six roles held, so the chips fold into one select in a narrow dialog. */
export const NarrowContainer: Story = {
  args: { roles: ["owner", "steward", "evaluator", "gardener"] },
  decorators: [
    (Story) => (
      <div className="@container w-[360px] space-y-3">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("combobox", { name: "Filter members by role" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Evaluators" })).toBeNull();
  },
};

function Filtering(args: ComponentProps<typeof ManageRolesFilters>) {
  const [activeFilter, setActiveFilter] = useState<RoleFilter>("all");
  return (
    <ManageRolesFilters
      {...args}
      hasPicks
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      onShowPicked={() => setActiveFilter("selected")}
    />
  );
}

/** A role chip filters; pressed again, it lets go and the list shows everyone. */
export const PressAgainLetsGo: Story = {
  render: (args) => <Filtering {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const evaluators = canvas.getByRole("button", { name: "Evaluators" });
    await userEvent.click(evaluators);
    await expect(evaluators).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(evaluators);
    await expect(evaluators).toHaveAttribute("aria-pressed", "false");
    await expect(canvas.getByRole("button", { name: "All roles" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  },
};
