import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { STORY_ANA, STORY_JOAO, STORY_MARIA } from "../poolStoryFixtures";
import { SeedConfirmerList, type SeedConfirmerListProps } from "./SeedConfirmerList";

/**
 * The list reads and writes the real composer form, and the console holds the
 * address being typed so it survives a step change.
 */
function SeedConfirmerListWithForm(args: SeedConfirmerListProps) {
  const form = useCommitmentComposerForm(args.values);
  const [draft, setDraft] = useState(args.confirmerDraft);
  return (
    <SeedConfirmerList
      {...args}
      form={form}
      values={form.watch()}
      confirmerDraft={draft}
      onConfirmerDraftChange={setDraft}
      onAddConfirmer={() => {
        form.setValue("confirmers", [...form.getValues("confirmers"), draft.trim()], {
          shouldDirty: true,
          shouldValidate: true,
        });
        setDraft("");
      }}
    />
  );
}

const meta: Meta<typeof SeedConfirmerList> = {
  title: "Admin/Pool/SeedConfirmerList",
  component: SeedConfirmerList,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Who confirms a seeded commitment. Naming nobody leaves the ordinary rule in place, which reads one way for an offer and another for a request. Naming people turns on the threshold, and the contract keeps the lead and every contributor out of that group.",
      },
    },
  },
  args: {
    values: { ...COMMITMENT_COMPOSER_DEFAULTS, direction: "OFFER" },
    busy: false,
    errorOf: () => undefined,
    confirmerDraft: "",
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

export const NamedGroup: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      confirmers: [STORY_MARIA, STORY_JOAO, STORY_ANA],
      confirmationThreshold: 2,
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
