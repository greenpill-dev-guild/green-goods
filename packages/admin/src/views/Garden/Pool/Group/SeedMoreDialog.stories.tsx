import type { Meta, StoryObj } from "@storybook/react";
import { withAdminIdentity } from "../../../../../../shared/.storybook/decorators";
import { SeedMoreDialog } from "./SeedMoreDialog";

const meta = {
  title: "Admin/Pool/SeedMoreDialog",
  component: SeedMoreDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Seed More Like This (PRD-1022 D4, screens 26–27), from a group's inspector: one question before any flow opens. Add to this group keeps its terms and deadline and asks only how many; Start a new group opens Seed Promises from the same terms, everything editable. Adding closes, with its reason, once the deadline has passed or for a steward who didn't create the group.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    onContinue: () => undefined,
    title: "Household water survey",
    due: "Mon, Oct 12, 2026, 3:42 PM PDT",
    addRefusal: null,
  },
  decorators: [withAdminIdentity],
} satisfies Meta<typeof SeedMoreDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddOrStartNew: Story = {};

/** The deadline has passed: only a new group can be started. */
export const DeadlinePassed: Story = { args: { addRefusal: "expired" } };

/** Another steward's group: their copies would split from it, so they start a new one. */
export const SomeoneElsesGroup: Story = { args: { addRefusal: "not-creator" } };
