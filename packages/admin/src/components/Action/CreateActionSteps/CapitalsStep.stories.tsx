import type { CreateActionFormData } from "@green-goods/shared/hooks/action/useActionForm";
import { createActionResolver } from "@green-goods/shared/hooks/admin-ui/actions/createAction.utils";
import type { Meta, StoryObj } from "@storybook/react";
import { useForm } from "react-hook-form";
import { CapitalsStep } from "./CapitalsStep";

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
  },
  translations: {},
};

function CapitalsStepHarness({ capitals = [] }: { capitals?: number[] }) {
  const form = useForm<CreateActionFormData>({
    defaultValues: { ...BASE_DEFAULTS, capitals },
    resolver: createActionResolver,
    mode: "onChange",
  });
  return <CapitalsStep form={form} />;
}

const meta: Meta<typeof CapitalsStepHarness> = {
  title: "Admin/Workflows/Action/CapitalsStep",
  // storybook-quality-allow state-harness: supplies form state while rendering the real CapitalsStep.
  component: CapitalsStepHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Forms-of-capital multi-select plus media upload. Used as step 2 of the action wizard.",
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
type Story = StoryObj<typeof CapitalsStepHarness>;

export const NoCapitalsSelected: Story = {};

export const WithSelection: Story = {
  args: {
    capitals: [0, 3, 4],
  },
};

export const AllCapitalsSelected: Story = {
  args: {
    capitals: [0, 1, 2, 3, 4, 5, 6, 7],
  },
};
