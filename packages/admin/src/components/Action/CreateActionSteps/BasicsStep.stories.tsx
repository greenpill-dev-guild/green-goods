import { createActionSchema, type CreateActionFormData } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BasicsStep } from "./BasicsStep";

const DOMAIN_OPTIONS = [
  { value: 0, label: "Solar" },
  { value: 1, label: "Agroforestry" },
  { value: 2, label: "Education" },
  { value: 3, label: "Waste" },
];

const FIXED_START = new Date("2026-05-01T00:00:00Z");
const FIXED_END = new Date("2026-05-30T00:00:00Z");

const EMPTY_DEFAULTS: CreateActionFormData = {
  title: "",
  slug: "",
  domain: 0,
  startTime: FIXED_START,
  endTime: FIXED_END,
  capitals: [],
  media: [],
  instructionConfig: {
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
      details: {
        title: "",
        description: "",
        feedbackPlaceholder: "",
        inputs: [],
      },
      review: { title: "", description: "" },
    },
  },
};

function BasicsStepHarness({
  defaults = EMPTY_DEFAULTS,
  triggerValidation = false,
}: {
  defaults?: CreateActionFormData;
  triggerValidation?: boolean;
}) {
  const form = useForm<CreateActionFormData>({
    defaultValues: defaults,
    resolver: zodResolver(createActionSchema),
    mode: "onChange",
  });

  useEffect(() => {
    if (triggerValidation) {
      void form.trigger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per story mount
  }, []);

  return <BasicsStep form={form} domainOptions={DOMAIN_OPTIONS} />;
}

const meta: Meta<typeof BasicsStepHarness> = {
  title: "Admin/Workflows/Action/BasicsStep",
  // storybook-quality-allow state-harness: supplies React Hook Form state while rendering the real BasicsStep.
  component: BasicsStepHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "First step of the create-action wizard. Captures title, slug, domain, and start/end dates. Hosts its state in a React Hook Form instance provided by the parent wizard.",
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
type Story = StoryObj<typeof BasicsStepHarness>;

export const Empty: Story = {};

export const Prefilled: Story = {
  args: {
    defaults: {
      ...EMPTY_DEFAULTS,
      title: "Riverbank cleanup cycle",
      slug: "waste.cleanup_event",
      domain: 3,
      startTime: FIXED_START,
      endTime: FIXED_END,
    },
  },
};

export const WithValidationErrors: Story = {
  args: {
    triggerValidation: true,
  },
};
