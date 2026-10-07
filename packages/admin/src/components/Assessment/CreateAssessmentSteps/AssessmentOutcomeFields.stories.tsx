import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useId, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { AssessmentOutcomeFields, AssessmentOutcomeHelp } from "./AssessmentOutcomeFields";

function OutcomeFieldsStory(args: ComponentProps<typeof AssessmentOutcomeFields>) {
  const [outcome, setOutcome] = useState(args.outcome);
  const id = useId();
  const helpIds = {
    description: `${id}-description`,
    metric: `${id}-metric`,
    target: `${id}-target`,
  };
  return (
    <div className="space-y-3">
      <AssessmentOutcomeHelp helpIds={helpIds} />
      <AssessmentOutcomeFields
        {...args}
        outcome={outcome}
        helpIds={helpIds}
        onChange={(field, value) => {
          setOutcome((current) => ({ ...current, [field]: value }));
          args.onChange(field, value);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Admin/Workflows/Assessment/OutcomeFields",
  component: AssessmentOutcomeFields,
  tags: ["autodocs"],
  render: (args) => <OutcomeFieldsStory {...args} />,
  decorators: [
    (Story) => (
      <div className="@container mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
  argTypes: { selectedMetricCounts: { control: false }, helpIds: { control: false } },
  args: {
    outcome: { description: "", metric: "", target: 0 },
    metrics: [{ key: "treesPlanted", label: "Trees planted", unit: "trees" }],
    selectedMetricCounts: new Map(),
    errors: {},
    helpIds: { description: "description-help", metric: "metric-help", target: "target-help" },
    isSubmitting: false,
    canRemove: true,
    onChange: fn(),
    onBlur: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof AssessmentOutcomeFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const outcome = canvas.getByRole("textbox", { name: "Outcome" });
    await expect(outcome).toHaveAccessibleDescription("The change you want to see");
    await userEvent.type(outcome, "Native habitat recovers");
    await expect(outcome).toHaveValue("Native habitat recovers");
    await userEvent.click(canvas.getByRole("combobox", { name: "Metric" }));
    await expect(args.onBlur).toHaveBeenCalledWith("description");
  },
};

export const ValidationErrors: Story = {
  args: {
    outcome: { description: "", metric: "", target: -1 },
    errors: {
      description: "Description is required",
      metric: "Select a metric",
      target: "Use 0 or more",
    },
  },
};

export const Submitting: Story = {
  args: {
    outcome: { description: "Native habitat recovers", metric: "treesPlanted", target: 200 },
    isSubmitting: true,
  },
};
