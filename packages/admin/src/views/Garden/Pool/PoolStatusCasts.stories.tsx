import type { Meta, StoryObj } from "@storybook/react";
import { PoolStatusCasts } from "./PoolStatusCasts";
import { storyPoolConsole } from "./poolStoryFixtures";

const meta: Meta<typeof PoolStatusCasts> = {
  title: "Admin/Pool/PoolStatusCasts",
  component: PoolStatusCasts,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "What the pool console shows before it has a console to show: loading, a read error that says nothing changed, a chain that does not serve pooling yet, and a garden with no pool registered. Renders nothing once the console itself can render.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolStatusCasts>;

export const Loading: Story = {
  args: { pool: storyPoolConsole({ isLoading: true }) },
};

export const ReadError: Story = {
  args: { pool: storyPoolConsole({ isError: true }) },
};

export const NotOnThisChain: Story = {
  args: {
    pool: storyPoolConsole({
      pool: null,
      availability: { status: "unavailable", reason: "not-integrated" } as never,
    }),
  },
};

export const NoPoolRegistered: Story = {
  args: { pool: storyPoolConsole({ pool: null }) },
};
