import { Domain, useCreateAssessmentStore } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { DomainContextStep } from "./DomainContextStep";

interface SeedFields {
  title?: string;
  description?: string;
  location?: string;
  domain?: Domain;
}

function WithAssessmentStore({ seed, children }: { seed: SeedFields; children: React.ReactNode }) {
  const setField = useCreateAssessmentStore((s) => s.setField);
  const reset = useCreateAssessmentStore((s) => s.reset);

  useEffect(() => {
    reset();
    if (seed.domain !== undefined) setField("domain", seed.domain);
    if (seed.title !== undefined) setField("title", seed.title);
    if (seed.description !== undefined) setField("description", seed.description);
    if (seed.location !== undefined) setField("location", seed.location);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per story mount
  }, []);

  return <>{children}</>;
}

const meta: Meta<typeof DomainContextStep> = {
  title: "Admin/Workflows/Assessment/DomainContextStep",
  component: DomainContextStep,
  tags: ["autodocs"],
  argTypes: {
    showValidation: { control: "boolean" },
    isSubmitting: { control: "boolean" },
    gardenDomainMask: {
      control: "number",
      description: "Bitmask of domains available in the garden. Undefined = all domains.",
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Assessment wizard step 1. Domain selector + title/description/location fields. Reads and writes to the persisted createAssessment Zustand store.",
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
type Story = StoryObj<typeof DomainContextStep>;

export const Empty: Story = {
  decorators: [
    (Story) => (
      <WithAssessmentStore seed={{}}>
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
      <WithAssessmentStore seed={{}}>
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
          title: "Cerrado restoration — Q1 assessment",
          description:
            "Multi-species planting across degraded pasture to rebuild soil organic matter.",
          location: "Alto Paraíso, Goiás",
        }}
      >
        <Story />
      </WithAssessmentStore>
    ),
  ],
};

export const SingleDomainAutoSelect: Story = {
  args: {
    gardenDomainMask: 1 << Domain.SOLAR,
  },
  decorators: [
    (Story) => (
      <WithAssessmentStore seed={{}}>
        <Story />
      </WithAssessmentStore>
    ),
  ],
};
