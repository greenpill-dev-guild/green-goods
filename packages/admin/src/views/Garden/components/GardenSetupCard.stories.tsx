import type { GardenSetup } from "@green-goods/shared/hooks/garden/useGardenOperations";
import type { Meta, StoryObj } from "@storybook/react";
import { GardenSetupCard } from "./GardenSetupCard";

function storySetup(overrides: Partial<GardenSetup> = {}): GardenSetup {
  return {
    steps: [
      { id: "name", status: "missing", fix: "self" },
      { id: "community", status: "done", fix: "team" },
      { id: "pools", status: "missing", fix: "self" },
      { id: "vaults", status: "done", fix: "self" },
      { id: "jars", status: "missing", fix: "team" },
      { id: "commitmentPool", status: "done", fix: "team" },
    ],
    needsAttention: true,
    hasPending: false,
    slug: "rio-rainforest-lab",
    isLoading: false,
    finishing: null,
    finish: async () => {},
    ...overrides,
  };
}

const meta: Meta<typeof GardenSetupCard> = {
  title: "Admin/Garden/GardenSetupCard",
  component: GardenSetupCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "What creating a garden should have set up, on its Health tab, shown only while a part is missing or still on its way. Reads the chain, so it answers before the indexer does.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GardenSetupCard>;

export const SomePartsMissing: Story = { args: { setup: storySetup() } };

export const WaitingOnTheNameFund: Story = {
  args: {
    setup: storySetup({
      steps: [
        { id: "name", status: "missing", fix: "waiting" },
        { id: "community", status: "done", fix: "team" },
        { id: "pools", status: "done", fix: "self" },
        { id: "vaults", status: "done", fix: "self" },
        { id: "jars", status: "done", fix: "team" },
        { id: "commitmentPool", status: "done", fix: "team" },
      ],
    }),
  },
};

export const Finishing: Story = { args: { setup: storySetup({ finishing: "name" }) } };

/** A garden minted after its steward Safe joined the mint, before settlement accounts did. */
export const NewGardenAwaitingSettlement: Story = {
  args: {
    setup: storySetup({
      needsAttention: false,
      hasPending: true,
      steps: [
        { id: "name", status: "done", fix: "self" },
        { id: "community", status: "done", fix: "team" },
        { id: "pools", status: "done", fix: "self" },
        { id: "vaults", status: "done", fix: "self" },
        { id: "jars", status: "done", fix: "team" },
        { id: "commitmentPool", status: "done", fix: "team" },
        { id: "stewardSafe", status: "done", fix: "team" },
        { id: "settlement", status: "pending", fix: "team", pendingOn: "update" },
      ],
    }),
  },
};

/** A mint that left the garden without its Safe request, while its settlement account is on its way. */
export const NewGardenSafeMissing: Story = {
  args: {
    setup: storySetup({
      steps: [
        { id: "name", status: "done", fix: "self" },
        { id: "community", status: "done", fix: "team" },
        { id: "pools", status: "done", fix: "self" },
        { id: "vaults", status: "done", fix: "self" },
        { id: "jars", status: "done", fix: "team" },
        { id: "commitmentPool", status: "done", fix: "team" },
        { id: "stewardSafe", status: "missing", fix: "team" },
        { id: "settlement", status: "pending", fix: "team", pendingOn: "delivery" },
      ],
    }),
  },
};
