import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { StepIndicator, type Step } from "./StepIndicator";

const steps: Step[] = [
  { id: "details", title: "Details", description: "Basic garden information" },
  { id: "team", title: "Team", description: "Operators and contributors" },
  { id: "impact", title: "Impact", description: "Metrics and evidence" },
  { id: "review", title: "Review", description: "Final checks before launch" },
];

const meta: Meta<typeof StepIndicator> = {
  title: "Shared/Form/StepIndicator",
  component: StepIndicator,
  tags: ["autodocs"],
  argTypes: {
    steps: {
      control: false,
      description: "Ordered list of workflow steps.",
    },
    currentStep: {
      control: { type: "number", min: 0, max: 3 },
      description: "Zero-based active step index.",
    },
    onStepClick: {
      control: false,
      description: "Optional callback for navigating back to a completed step.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = {
  args: {
    steps,
    currentStep: 0,
  },
};

export const MidFlow: Story = {
  args: {
    steps,
    currentStep: 2,
  },
};

export const FinalReview: Story = {
  args: {
    steps,
    currentStep: 3,
  },
};

export const ClickableCompletedSteps: Story = {
  args: {
    steps,
    currentStep: 2,
    onStepClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const completedStep = canvas.getByRole("button", { name: "Go to Details" });

    await userEvent.click(completedStep);
    await expect(args.onStepClick).toHaveBeenCalledWith(0);
  },
};

export const Gallery: Story = {
  args: {
    steps,
    currentStep: 2,
    onStepClick: fn(),
  },
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">Initial step</h3>
        <StepIndicator steps={steps} currentStep={0} />
      </section>
      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">Impact step with back navigation</h3>
        <StepIndicator steps={steps} currentStep={2} onStepClick={fn()} />
      </section>
      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">Final review</h3>
        <StepIndicator steps={steps} currentStep={3} onStepClick={fn()} />
      </section>
    </div>
  ),
};
