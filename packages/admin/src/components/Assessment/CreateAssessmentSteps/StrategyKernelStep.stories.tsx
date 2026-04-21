import {
  CynefinPhase,
  Domain,
  type SmartOutcome,
  useCreateAssessmentStore,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { StrategyKernelStep } from "./StrategyKernelStep";

interface Seed {
  domain?: Domain;
  diagnosis?: string;
  smartOutcomes?: SmartOutcome[];
  cynefinPhase?: CynefinPhase;
}

function WithAssessmentStore({ seed, children }: { seed: Seed; children: React.ReactNode }) {
  const setField = useCreateAssessmentStore((s) => s.setField);
  const reset = useCreateAssessmentStore((s) => s.reset);

  useEffect(() => {
    reset();
    if (seed.domain !== undefined) setField("domain", seed.domain);
    if (seed.diagnosis !== undefined) setField("diagnosis", seed.diagnosis);
    if (seed.smartOutcomes !== undefined) setField("smartOutcomes", seed.smartOutcomes);
    if (seed.cynefinPhase !== undefined) setField("cynefinPhase", seed.cynefinPhase);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per story mount
  }, []);

  return <>{children}</>;
}

const meta: Meta<typeof StrategyKernelStep> = {
  title: "Admin/Workflows/Assessment/StrategyKernelStep",
  component: StrategyKernelStep,
  tags: ["autodocs"],
  argTypes: {
    showValidation: { control: "boolean" },
    isSubmitting: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Assessment wizard step 2. Diagnosis, SMART outcomes (repeater), and Cynefin phase selector. Writes to the persisted Zustand store.",
      },
    },
  },
  args: {
    showValidation: false,
    isSubmitting: false,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof StrategyKernelStep>;

export const Empty: Story = {
  decorators: [
    (Story) => (
      <WithAssessmentStore seed={{ domain: Domain.AGRO, smartOutcomes: [] }}>
        <Story />
      </WithAssessmentStore>
    ),
  ],
};

export const WithValidationErrors: Story = {
  args: {
    showValidation: true,
  },
  decorators: [
    (Story) => (
      <WithAssessmentStore seed={{ domain: Domain.AGRO, smartOutcomes: [] }}>
        <Story />
      </WithAssessmentStore>
    ),
  ],
};

export const Prefilled: Story = {
  decorators: [
    (Story) => (
      <WithAssessmentStore
        seed={{
          domain: Domain.AGRO,
          diagnosis:
            "Degraded pasture with <1% soil organic matter; fragmented native species corridors limit pollinator movement.",
          smartOutcomes: [
            { description: "Plant native seedlings", metric: "treesPlanted", target: 200 },
            { description: "Restore contiguous corridor", metric: "areaCoveredHa", target: 5 },
          ],
          cynefinPhase: CynefinPhase.COMPLEX,
        }}
      >
        <Story />
      </WithAssessmentStore>
    ),
  ],
};

export const SubmittingState: Story = {
  args: {
    isSubmitting: true,
  },
  decorators: [
    (Story) => (
      <WithAssessmentStore
        seed={{
          domain: Domain.SOLAR,
          diagnosis: "Rural households rely on diesel generators averaging 4h/day.",
          smartOutcomes: [
            { description: "Install rooftop solar", metric: "panelsInstalled", target: 50 },
          ],
          cynefinPhase: CynefinPhase.COMPLICATED,
        }}
      >
        <Story />
      </WithAssessmentStore>
    ),
  ],
};
