import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { useCreateGardenStore, type Address } from "@green-goods/shared";
import { TeamStep } from "./TeamStep";

const MOCK_ADDRESSES: Address[] = [
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address, // vitalik.eth
  "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" as Address,
  "0x1234567890AbcdEF1234567890aBcdef12345678" as Address,
];

/**
 * Decorator that pre-populates the Zustand store with team members.
 */
function WithStoreState({
  children,
  gardeners = [],
  operators = [],
}: {
  children: React.ReactNode;
  gardeners?: Address[];
  operators?: Address[];
}) {
  const reset = useCreateGardenStore((s) => s.reset);
  const setField = useCreateGardenStore((s) => s.setField);

  useEffect(() => {
    reset();
    if (gardeners.length > 0) setField("gardeners", gardeners);
    if (operators.length > 0) setField("operators", operators);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Storybook initializer: run once on mount only
  }, []);

  return <>{children}</>;
}

const meta: Meta<typeof TeamStep> = {
  title: "Admin/Garden/TeamStep",
  component: TeamStep,
  tags: ["autodocs"],
  argTypes: {
    showValidation: {
      control: "boolean",
      description: "Whether to show validation state (team step has no required fields)",
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl mx-auto">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TeamStep>;

/**
 * Default empty state — no gardeners or operators added yet.
 * Shows the advisory banner and empty input fields.
 */
export const Default: Story = {
  args: {
    showValidation: false,
  },
  decorators: [
    (Story) => (
      <WithStoreState>
        <Story />
      </WithStoreState>
    ),
  ],
};

/**
 * Pre-populated with several gardeners and operators.
 */
export const WithMembers: Story = {
  args: {
    showValidation: false,
  },
  decorators: [
    (Story) => (
      <WithStoreState
        gardeners={[MOCK_ADDRESSES[0], MOCK_ADDRESSES[1]]}
        operators={[MOCK_ADDRESSES[2]]}
      >
        <Story />
      </WithStoreState>
    ),
  ],
};

/**
 * Only gardeners, no operators — common for smaller gardens.
 */
export const GardenersOnly: Story = {
  args: {
    showValidation: false,
  },
  decorators: [
    (Story) => (
      <WithStoreState gardeners={MOCK_ADDRESSES}>
        <Story />
      </WithStoreState>
    ),
  ],
};

export const DarkMode: Story = {
  args: {
    showValidation: false,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <WithStoreState gardeners={[MOCK_ADDRESSES[0]]} operators={[MOCK_ADDRESSES[1]]}>
          <div className="max-w-2xl mx-auto">
            <Story />
          </div>
        </WithStoreState>
      </div>
    ),
  ],
};

/**
 * Gallery showing empty, partially filled, and fully loaded states.
 */
export const Gallery: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">Empty team</h3>
        <div className="rounded-lg border border-stroke-soft p-4">
          <WithStoreState>
            <TeamStep showValidation={false} />
          </WithStoreState>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">With gardeners and operators</h3>
        <div className="rounded-lg border border-stroke-soft p-4">
          <WithStoreState
            gardeners={[MOCK_ADDRESSES[0], MOCK_ADDRESSES[1]]}
            operators={[MOCK_ADDRESSES[2]]}
          >
            <TeamStep showValidation={false} />
          </WithStoreState>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">Many members (scroll test)</h3>
        <div className="rounded-lg border border-stroke-soft p-4">
          <WithStoreState gardeners={MOCK_ADDRESSES} operators={MOCK_ADDRESSES}>
            <TeamStep showValidation={false} />
          </WithStoreState>
        </div>
      </div>
    </div>
  ),
};
