import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { Meta, StoryObj } from "@storybook/react";
import { SeedStepWhat, type SeedStepWhatProps } from "./SeedStepWhat";
import type { SeedCycleOption } from "./seedStepModel";

// The cycle selector the console builds from the garden's open cycles: the one
// season, then the campaigns, then cycle-less.
const CYCLE_OPTIONS: SeedCycleOption[] = [
  { value: "12", label: "Season · Season of First Rains" },
  { value: "13", label: "Campaign · Market rides" },
  { value: "0", label: "No cycle (runs on its own)" },
];

/** The step reads and writes the real composer form, exactly as the console does. */
function SeedStepWhatWithForm(args: SeedStepWhatProps) {
  const form = useCommitmentComposerForm(args.values);
  return <SeedStepWhat {...args} form={form} values={form.watch()} />;
}

const meta: Meta<typeof SeedStepWhat> = {
  title: "Admin/Pool/SeedStepWhat",
  component: SeedStepWhat,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Step one of the seeding console. The steward says which season or campaign holds the commitment, whether it is support or garden work, and which way it runs, and the words a member will read on it. The title stops at 60 characters and the note at 280, both counted as the steward types.",
      },
    },
  },
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SERVICE",
      cycleId: "12",
      title: "Market rides for the co-op",
      note: "Riders take produce from the garden to Saturday market.",
    },
    noteId: "seed-what",
    busy: false,
    errorOf: () => undefined,
    cycleOptions: CYCLE_OPTIONS,
  },
  render: (args) => <SeedStepWhatWithForm {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedStepWhat>;

export const SeasonOffer: Story = {};

export const GardenWork: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "GARDEN_WORK",
      cycleId: "12",
      title: "Prune the orchard",
      unitLabel: "hours",
    },
  },
};

export const ServiceRequest: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SERVICE",
      direction: "REQUEST",
      cycleId: "13",
      title: "Someone to fix the water pump",
      note: "",
    },
  },
};

export const MissingTitle: Story = {
  args: {
    values: { ...COMMITMENT_COMPOSER_DEFAULTS, kind: "SERVICE", cycleId: "12", title: "" },
    errorOf: (field) => (field === "title" ? "Give it a name" : undefined),
  },
};

export const Queuing: Story = { args: { busy: true } };
