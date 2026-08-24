import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { STORY_JOAO, STORY_MARIA } from "../poolStoryFixtures";
import { SeedStepProof, type SeedStepProofProps } from "./SeedStepProof";

/**
 * The step reads and writes the real composer form, and the console holds the
 * address being typed so it survives a step change.
 */
function SeedStepProofWithForm(args: SeedStepProofProps) {
  const form = useCommitmentComposerForm(args.values);
  const [draft, setDraft] = useState(args.confirmerDraft);
  return (
    <SeedStepProof
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

const meta: Meta<typeof SeedStepProof> = {
  title: "Admin/Pool/SeedStepProof",
  component: SeedStepProof,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Step three of the seeding console. Who confirms this commitment, whether the Green Goods team may step in when nobody local can, whether members take it up freely or wait for review, and the declared reward folded away as advanced.",
      },
    },
  },
  args: {
    values: { ...COMMITMENT_COMPOSER_DEFAULTS, kind: "SEASON_CAMPAIGN", title: "Market rides" },
    noteId: "seed-proof",
    busy: false,
    errorOf: () => undefined,
    confirmerDraft: "",
    protocolRegistered: true,
    settlementActive: false,
  },
  render: (args) => <SeedStepProofWithForm {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedStepProof>;

export const OrdinaryRule: Story = {};

export const NamedGroup: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SEASON_CAMPAIGN",
      title: "Market rides",
      claimMode: "APPROVAL_GATED",
      confirmers: [STORY_MARIA, STORY_JOAO],
      confirmationThreshold: 2,
    },
  },
};

export const NoProtocolPool: Story = {
  args: { protocolRegistered: false },
};

export const SettlementReady: Story = {
  args: { settlementActive: true },
};
