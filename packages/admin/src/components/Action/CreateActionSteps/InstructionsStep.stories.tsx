import { createActionSchema, type CreateActionFormData } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InstructionsStep } from "./InstructionsStep";

const BASE_DEFAULTS: CreateActionFormData = {
  title: "",
  slug: "",
  domain: 0,
  startTime: new Date("2026-05-01T00:00:00Z"),
  endTime: new Date("2026-05-30T00:00:00Z"),
  capitals: [],
  media: [],
  instructionConfig: {
    description: "",
    uiConfig: {
      media: {
        title: "Capture Media",
        description: "Document the work with photos.",
        maxImageCount: 4,
        minImageCount: 1,
        required: true,
        needed: ["Before shot"],
        optional: ["Detail shot"],
      },
      details: {
        title: "Enter Details",
        description: "Describe what was completed.",
        feedbackPlaceholder: "Observations…",
        inputs: [
          {
            key: "plantCount",
            title: "Plants installed",
            placeholder: "Number",
            type: "number",
            required: true,
            options: [],
          },
        ],
      },
      review: {
        title: "Review & Submit",
        description: "Check everything before submitting.",
      },
    },
  },
};

function InstructionsStepHarness() {
  const form = useForm<CreateActionFormData>({
    defaultValues: BASE_DEFAULTS,
    resolver: zodResolver(createActionSchema),
    mode: "onChange",
  });
  return <InstructionsStep form={form} />;
}

const meta: Meta<typeof InstructionsStepHarness> = {
  title: "Admin/Workflows/Action/InstructionsStep",
  // storybook-quality-allow state-harness: supplies form state while rendering the real InstructionsStep.
  component: InstructionsStepHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Template picker followed by the embedded InstructionsBuilder (tabs for media, form inputs, and review). Step 3 of the action wizard.",
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
type Story = StoryObj<typeof InstructionsStepHarness>;

export const Default: Story = {};
