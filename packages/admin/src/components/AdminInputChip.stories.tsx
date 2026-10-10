import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminInputChip } from "./AdminInputChip";

const meta: Meta<typeof AdminInputChip> = {
  title: "Admin/Primitives/AdminInputChip",
  component: AdminInputChip,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 input chip for a choice the steward can take back out, such as a named confirmer: 32dp, an outline over the low container fill, an optional 24dp avatar and a remove button. Chips flow in a wrapping row inside a named list.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminInputChip>;

export const WithAvatar: Story = {
  args: {
    label: "lina",
    text: "lina",
    avatar: "L",
    removeLabel: "Remove lina",
    onRemove: () => {},
  },
};

export const AddressOnly: Story = {
  args: {
    label: "0x7e21…c04a",
    text: "0x7e21f9c04a",
    removeLabel: "Remove 0x7e21…c04a",
    onRemove: () => {},
  },
};

export const Disabled: Story = {
  args: { ...WithAvatar.args, disabled: true },
};

/** Several choices wrap only when the row is full, and removing one closes the gap. */
export const ChosenPeople: Story = {
  render: () => {
    function Chosen() {
      const [people, setPeople] = useState(["lina", "mara", "sofia.eth", "0x7e21…c04a"]);
      return (
        <div role="list" aria-label="Chosen confirmers" className="flex max-w-md flex-wrap gap-2">
          {people.map((name) => (
            <AdminInputChip
              key={name}
              label={name}
              text={name}
              avatar={name.startsWith("0x") ? undefined : name.slice(0, 1).toUpperCase()}
              removeLabel={`Remove ${name}`}
              onRemove={() => setPeople((current) => current.filter((entry) => entry !== name))}
            />
          ))}
        </div>
      );
    }
    return <Chosen />;
  },
};
