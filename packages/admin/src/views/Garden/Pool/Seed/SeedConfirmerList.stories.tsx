import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { Meta, StoryObj } from "@storybook/react";
import { STORY_ANA, STORY_JOAO, STORY_MARIA } from "../poolStoryFixtures";
import {
  SeedConfirmerList,
  type SeedConfirmerListProps,
  type SeedMember,
} from "./SeedConfirmerList";

const MEMBERS: SeedMember[] = [
  { address: STORY_MARIA, role: "steward" },
  { address: STORY_JOAO, role: "gardener" },
  { address: STORY_ANA, role: "gardener" },
  { address: "0x4444444444444444444444444444444444444444", role: "gardener" },
  { address: "0x5555555555555555555555555555555555555555", role: "evaluator" },
  { address: "0x6666666666666666666666666666666666666666", role: "owner" },
];

/** The list reads and writes the real composer form, as the flow does. */
function SeedConfirmerListWithForm(args: SeedConfirmerListProps) {
  const form = useCommitmentComposerForm(args.values);
  return <SeedConfirmerList {...args} form={form} values={form.watch()} />;
}

const meta: Meta<typeof SeedConfirmerList> = {
  title: "Admin/Pool/SeedConfirmerList",
  component: SeedConfirmerList,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Who confirms a seeded promise (PRD-1022 D8, D15). Chosen people show as removable chips in one row that wraps only after many. People come from the garden in one tap, or from one field that takes a name.eth or an address. Naming nobody leaves the ordinary rule in place.",
      },
    },
  },
  args: {
    values: { ...COMMITMENT_COMPOSER_DEFAULTS, direction: "OFFER" },
    busy: false,
    errorOf: () => undefined,
    members: MEMBERS,
  },
  render: (args) => <SeedConfirmerListWithForm {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedConfirmerList>;

export const NobodyNamedOnAnOffer: Story = {};

export const NobodyNamedOnARequest: Story = {
  args: { values: { ...COMMITMENT_COMPOSER_DEFAULTS, direction: "REQUEST" } },
};

/** Chosen people take only their own width; the garden's others stay one tap away. */
export const ChosenAsChips: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      confirmers: [STORY_MARIA, STORY_JOAO, STORY_ANA],
      confirmationThreshold: 2,
    },
  },
};

/** Many chosen: the chips wrap onto a second row only now. */
export const ManyChosen: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      confirmers: MEMBERS.map((member) => member.address),
      confirmationThreshold: 3,
    },
  },
};

export const ThresholdAboveTheGroup: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      confirmers: [STORY_MARIA, STORY_JOAO],
      confirmationThreshold: 3,
    },
    errorOf: (field) =>
      field === "confirmationThreshold"
        ? "That asks for more confirmations than there are named confirmers."
        : undefined,
  },
};

export const NoMembersToSuggest: Story = { args: { members: [] } };
