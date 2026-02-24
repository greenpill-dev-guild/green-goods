import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { Address, GardenRole } from "@green-goods/shared";
import { AddMemberModal } from "./AddMemberModal";

/**
 * Simulates a successful add with a small delay (mimics on-chain tx).
 */
const mockOnAdd = fn(async (_address: Address) => {
  await new Promise((resolve) => setTimeout(resolve, 800));
});

const meta: Meta<typeof AddMemberModal> = {
  title: "Admin/Garden/AddMemberModal",
  component: AddMemberModal,
  tags: ["autodocs"],
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Controls whether the modal is visible",
    },
    onClose: {
      description: "Callback when the modal requests to close",
    },
    memberType: {
      control: "select",
      options: [
        "gardener",
        "operator",
        "evaluator",
        "owner",
        "funder",
        "community",
      ] satisfies GardenRole[],
      description: "The garden role being assigned to the new member",
    },
    onAdd: {
      description: "Async callback invoked with the resolved address when the user submits",
    },
    isLoading: {
      control: "boolean",
      description: "When true, the form is disabled and shows a loading state (e.g. pending tx)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AddMemberModal>;

/**
 * Default open modal for adding a gardener.
 */
export const Default: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    memberType: "gardener",
    onAdd: mockOnAdd,
    isLoading: false,
  },
};

/**
 * Adding an operator — shows different role label.
 */
export const AddOperator: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    memberType: "operator",
    onAdd: mockOnAdd,
    isLoading: false,
  },
};

/**
 * Loading state — submit button disabled, form locked.
 */
export const Loading: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    memberType: "gardener",
    onAdd: mockOnAdd,
    isLoading: true,
  },
};

/**
 * Closed state — nothing renders (useful for testing open/close transitions).
 */
export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: fn(),
    memberType: "gardener",
    onAdd: mockOnAdd,
    isLoading: false,
  },
};

export const DarkMode: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    memberType: "gardener",
    onAdd: mockOnAdd,
    isLoading: false,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4 min-h-[400px]">
        <Story />
      </div>
    ),
  ],
};

/**
 * Gallery showing all role variants of the modal.
 */
export const Gallery: Story = {
  render: () => {
    const roles: GardenRole[] = ["gardener", "operator", "evaluator"];
    return (
      <div className="space-y-6">
        <p className="text-sm text-text-sub">
          Each role variant is shown below. In production these are full modals; here they render
          inline for comparison.
        </p>
        {roles.map((role) => (
          <div key={role}>
            <h3 className="text-sm font-medium text-text-sub mb-2 capitalize">{role}</h3>
            <div className="rounded-lg border border-stroke-soft p-1 relative min-h-[350px]">
              <AddMemberModal
                isOpen={true}
                onClose={fn()}
                memberType={role}
                onAdd={mockOnAdd}
                isLoading={false}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};
