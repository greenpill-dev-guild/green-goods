import type { ActionInstructionConfig } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DetailsConfigSection } from "./DetailsConfigSection";

type DetailsConfig = ActionInstructionConfig["uiConfig"]["details"];

const EMPTY_CONFIG: DetailsConfig = {
  title: "Enter Details",
  description: "",
  feedbackPlaceholder: "",
  inputs: [],
};

const POPULATED_CONFIG: DetailsConfig = {
  title: "Enter Details",
  description: "Log what was planted and any observations.",
  feedbackPlaceholder: "How did the session go?",
  inputs: [
    {
      key: "plantCount",
      title: "Plants installed",
      placeholder: "Number of plants",
      type: "number",
      required: true,
      options: [],
    },
    {
      key: "species",
      title: "Species planted",
      placeholder: "Primary species",
      type: "select",
      required: false,
      options: ["Maize", "Beans", "Amaranth"],
    },
    {
      key: "notes",
      title: "Notes",
      placeholder: "Observations",
      type: "textarea",
      required: false,
      options: [],
    },
  ],
};

function DetailsConfigHarness({ initial }: { initial: DetailsConfig }) {
  const [config, setConfig] = useState<DetailsConfig>(initial);
  return <DetailsConfigSection config={config} onChange={setConfig} />;
}

const meta: Meta<typeof DetailsConfigHarness> = {
  title: "Admin/Workflows/Action/DetailsConfigSection",
  // storybook-quality-allow state-harness: owns local state while rendering the real DetailsConfigSection.
  component: DetailsConfigHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Form-input builder inside the InstructionsBuilder. Lets action creators define custom fields (text, number, select, etc.) the gardener will fill when submitting work.",
      },
    },
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
type Story = StoryObj<typeof DetailsConfigHarness>;

export const Empty: Story = {
  args: { initial: EMPTY_CONFIG },
};

export const WithInputs: Story = {
  args: { initial: POPULATED_CONFIG },
};

export const SelectWithOptions: Story = {
  args: {
    initial: {
      ...EMPTY_CONFIG,
      inputs: [
        {
          key: "weather",
          title: "Weather during session",
          placeholder: "",
          type: "select",
          required: true,
          options: ["Sunny", "Cloudy", "Rainy"],
        },
      ],
    },
  },
};
