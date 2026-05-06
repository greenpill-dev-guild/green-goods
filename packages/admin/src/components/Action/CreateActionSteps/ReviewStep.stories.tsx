import { createActionSchema, type CreateActionFormData } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReviewStep } from "./ReviewStep";

const DOMAIN_OPTIONS = [
  { value: 0, label: "Solar" },
  { value: 1, label: "Agroforestry" },
  { value: 2, label: "Education" },
  { value: 3, label: "Waste" },
];

function ReviewStepHarness({ overrides }: { overrides?: Partial<CreateActionFormData> }) {
  const defaults: CreateActionFormData = {
    title: "Riverbank cleanup cycle",
    slug: "waste.cleanup_event",
    domain: 3,
    startTime: new Date("2026-05-01T00:00:00Z"),
    endTime: new Date("2026-05-30T00:00:00Z"),
    capitals: [0, 3],
    media: [],
    instructionConfig: {
      description: "",
      uiConfig: {
        media: {
          title: "Capture Media",
          description: "Document the cleanup.",
          maxImageCount: 4,
          minImageCount: 1,
          required: true,
          needed: ["Before", "After"],
          optional: [],
        },
        details: {
          title: "Enter Details",
          description: "",
          feedbackPlaceholder: "",
          inputs: [
            {
              key: "kgCollected",
              title: "Kg collected",
              placeholder: "",
              type: "number",
              required: true,
              options: [],
            },
            {
              key: "participants",
              title: "Participants",
              placeholder: "",
              type: "number",
              required: false,
              options: [],
            },
          ],
        },
        review: { title: "Review", description: "" },
      },
    },
    ...overrides,
  };

  const form = useForm<CreateActionFormData>({
    defaultValues: defaults,
    resolver: zodResolver(createActionSchema),
    mode: "onChange",
  });
  return <ReviewStep form={form} domainOptions={DOMAIN_OPTIONS} />;
}

const meta: Meta<typeof ReviewStepHarness> = {
  title: "Admin/Workflows/Action/ReviewStep",
  // storybook-quality-allow state-harness: supplies form state while rendering the real ReviewStep.
  component: ReviewStepHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Summary view rendered as the final step of the action wizard. Reads form values directly — no inputs to validate here.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ReviewStepHarness>;

export const Populated: Story = {};

export const NoCustomFields: Story = {
  args: {
    overrides: {
      capitals: [0],
      instructionConfig: {
        description: "",
        uiConfig: {
          media: {
            title: "",
            description: "",
            maxImageCount: 1,
            minImageCount: 1,
            required: false,
            needed: [],
            optional: [],
          },
          details: { title: "", description: "", feedbackPlaceholder: "", inputs: [] },
          review: { title: "", description: "" },
        },
      },
    },
  },
};
