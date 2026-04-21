import type { ActionInstructionConfig } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { InstructionsBuilder } from "./InstructionsBuilder";

const EMPTY_CONFIG: ActionInstructionConfig = {
  description: "",
  uiConfig: {
    media: {
      title: "",
      description: "",
      maxImageCount: 3,
      minImageCount: 1,
      required: true,
      needed: [],
      optional: [],
    },
    details: { title: "", description: "", feedbackPlaceholder: "", inputs: [] },
    review: { title: "", description: "" },
  },
};

const POPULATED_CONFIG: ActionInstructionConfig = {
  description: "Waste cleanup cycle instructions",
  uiConfig: {
    media: {
      title: "Capture Media",
      description: "Before and after shots of the site.",
      maxImageCount: 6,
      minImageCount: 2,
      required: true,
      needed: ["Before shot", "After shot"],
      optional: ["Detail shot", "Volunteer group"],
    },
    details: {
      title: "Enter Details",
      description: "Log kilograms collected and the participant count.",
      feedbackPlaceholder: "How did the session go?",
      inputs: [
        {
          key: "kgCollected",
          title: "Kg collected",
          placeholder: "",
          type: "number",
          required: true,
          options: [],
        },
      ],
    },
    review: {
      title: "Review & Submit",
      description: "Confirm everything before submitting.",
    },
  },
};

function InstructionsBuilderHarness({ initial }: { initial: ActionInstructionConfig }) {
  const [value, setValue] = useState<ActionInstructionConfig>(initial);
  return <InstructionsBuilder value={value} onChange={setValue} />;
}

const meta: Meta<typeof InstructionsBuilderHarness> = {
  title: "Admin/Workflows/Action/InstructionsBuilder",
  component: InstructionsBuilderHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Tabbed editor for the instruction config: Media Configuration, Form Inputs, and Review Screen. Persists as structured JSON in the action contract.",
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
type Story = StoryObj<typeof InstructionsBuilderHarness>;

export const Empty: Story = {
  args: { initial: EMPTY_CONFIG },
};

export const Populated: Story = {
  args: { initial: POPULATED_CONFIG },
};
