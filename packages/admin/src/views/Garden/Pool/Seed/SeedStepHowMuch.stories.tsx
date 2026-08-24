import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Action } from "@green-goods/shared/types/domain";
import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { Meta, StoryObj } from "@storybook/react";
import { useFieldArray } from "react-hook-form";
import { STORYBOOK_ADMIN_ACTIONS } from "../../../../../../shared/.storybook/adminFixtures";
import { SeedStepHowMuch, type SeedStepHowMuchProps } from "./SeedStepHowMuch";

// The garden's registered actions, keyed the way the registry keys them: only a
// chain-scoped id resolves to an action UID the requirement rows can carry.
const SEED_ACTIONS: Action[] = STORYBOOK_ADMIN_ACTIONS.map((action, index) => ({
  ...action,
  id: `${DEFAULT_CHAIN_ID}-${index + 1}`,
}));

/** The step reads and writes the real composer form, exactly as the console does. */
function SeedStepHowMuchWithForm(args: SeedStepHowMuchProps) {
  const form = useCommitmentComposerForm(args.values);
  const requirements = useFieldArray({ control: form.control, name: "requirements" });
  return (
    <SeedStepHowMuch {...args} form={form} values={form.watch()} requirements={requirements} />
  );
}

const meta: Meta<typeof SeedStepHowMuch> = {
  title: "Admin/Pool/SeedStepHowMuch",
  component: SeedStepHowMuch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Step two of the seeding console. What is being counted and how much of it, when it is due, who may contribute, and for garden work the approved actions it is kept by.",
      },
    },
  },
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SERVICE",
      unitLabel: "rides",
      targetUnits: 12,
      dueInDays: 30,
    },
    noteId: "seed-how-much",
    busy: false,
    errorOf: () => undefined,
    actions: SEED_ACTIONS,
    chainId: DEFAULT_CHAIN_ID,
  },
  render: (args) => <SeedStepHowMuchWithForm {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedStepHowMuch>;

export const KeptByProof: Story = {};

export const GardenWork: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "GARDEN_WORK",
      unitLabel: "plots",
      targetUnits: 4,
      dueInDays: 45,
      openTeam: false,
      requirements: [
        { actionUID: "1", requiredCount: 3 },
        { actionUID: "2", requiredCount: 1 },
      ],
    },
  },
};

export const MissingUnitAndTarget: Story = {
  args: {
    values: { ...COMMITMENT_COMPOSER_DEFAULTS, kind: "SERVICE", unitLabel: "", targetUnits: 0 },
    errorOf: (field) =>
      field === "unitLabel"
        ? "Say what you are counting"
        : field === "targetUnits"
          ? "How many?"
          : undefined,
  },
};

export const Queuing: Story = { args: { busy: true } };
