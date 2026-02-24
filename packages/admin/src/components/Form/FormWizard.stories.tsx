import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import type { Step } from "./StepIndicator";
import { FormWizard } from "./FormWizard";

const mockSteps: Step[] = [
  { id: "details", title: "Details", description: "Garden name, location, and description" },
  { id: "team", title: "Team", description: "Add operators and gardeners" },
  { id: "actions", title: "Actions", description: "Configure conservation actions" },
  { id: "review", title: "Review", description: "Review and deploy" },
];

const twoSteps: Step[] = [
  { id: "info", title: "Information", description: "Basic details" },
  { id: "confirm", title: "Confirm", description: "Review and submit" },
];

/** Mock step content for demos */
function MockStepContent({ stepIndex }: { stepIndex: number }) {
  const labels = ["Details Form", "Team Configuration", "Action Setup", "Review Summary"];
  return (
    <div className="space-y-4 rounded-xl border border-stroke-soft bg-bg-white p-6">
      <h3 className="text-lg font-bold text-text-strong">
        {labels[stepIndex] ?? `Step ${stepIndex + 1}`}
      </h3>
      <p className="text-sm text-text-sub">
        This is placeholder content for step {stepIndex + 1}. In the real app, this would contain
        form fields and configuration options.
      </p>
      <div className="space-y-3">
        <div className="h-10 w-full rounded-lg border border-stroke-soft bg-bg-weak" />
        <div className="h-10 w-full rounded-lg border border-stroke-soft bg-bg-weak" />
        <div className="h-10 w-2/3 rounded-lg border border-stroke-soft bg-bg-weak" />
      </div>
    </div>
  );
}

const meta: Meta<typeof FormWizard> = {
  title: "Admin/UI/FormWizard",
  component: FormWizard,
  tags: ["autodocs"],
  argTypes: {
    steps: {
      control: false,
      description: "Array of step definitions with id, title, and description",
    },
    currentStep: {
      control: { type: "number", min: 0, max: 3 },
      description: "Zero-based index of the currently active step",
    },
    onNext: {
      control: false,
      description: "Called when the user clicks Next (not shown on last step)",
    },
    onBack: {
      control: false,
      description: "Called when the user clicks Back (not shown on first step)",
    },
    onCancel: {
      control: false,
      description: "Called when the user clicks Cancel",
    },
    onSubmit: {
      control: false,
      description: "Called when the user clicks Submit on the last step",
    },
    onStepClick: {
      control: false,
      description: "Called when the user clicks a completed step indicator to navigate back",
    },
    isSubmitting: {
      control: "boolean",
      description: "When true, shows loading state on the Submit button and disables navigation",
    },
    nextDisabled: {
      control: "boolean",
      description: "When true, the Next button is disabled (e.g., validation incomplete)",
    },
    validationMessage: {
      control: "text",
      description: "Warning message shown above navigation when nextDisabled is true",
    },
    nextLabel: {
      control: "text",
      description: "Custom label for the Next button (defaults to i18n 'Next')",
    },
    submitLabel: {
      control: "text",
      description: "Custom label for the Submit button (defaults to i18n 'Submit')",
    },
    children: {
      control: false,
      description: "Step content rendered in the main area",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof FormWizard>;

// --- Static step stories ---

export const Default: Story = {
  args: {
    steps: mockSteps,
    currentStep: 0,
    onNext: () => {},
    onCancel: () => {},
    children: <MockStepContent stepIndex={0} />,
  },
};

export const Step1_Details: Story = {
  args: {
    steps: mockSteps,
    currentStep: 0,
    onNext: () => {},
    onCancel: () => {},
    children: <MockStepContent stepIndex={0} />,
  },
};

export const Step2_Team: Story = {
  args: {
    steps: mockSteps,
    currentStep: 1,
    onNext: () => {},
    onBack: () => {},
    onCancel: () => {},
    children: <MockStepContent stepIndex={1} />,
  },
};

export const Step3_Actions: Story = {
  args: {
    steps: mockSteps,
    currentStep: 2,
    onNext: () => {},
    onBack: () => {},
    onCancel: () => {},
    children: <MockStepContent stepIndex={2} />,
  },
};

export const Step4_Review: Story = {
  args: {
    steps: mockSteps,
    currentStep: 3,
    onBack: () => {},
    onCancel: () => {},
    onSubmit: () => {},
    children: <MockStepContent stepIndex={3} />,
  },
};

// --- Validation state ---

export const WithValidationMessage: Story = {
  args: {
    steps: mockSteps,
    currentStep: 0,
    onNext: () => {},
    onCancel: () => {},
    nextDisabled: true,
    validationMessage: "Please fill in all required fields before continuing.",
    children: <MockStepContent stepIndex={0} />,
  },
};

// --- Submitting state ---

export const Submitting: Story = {
  args: {
    steps: mockSteps,
    currentStep: 3,
    onBack: () => {},
    onCancel: () => {},
    onSubmit: () => {},
    isSubmitting: true,
    children: <MockStepContent stepIndex={3} />,
  },
};

// --- Custom labels ---

export const CustomLabels: Story = {
  args: {
    steps: twoSteps,
    currentStep: 0,
    onNext: () => {},
    onCancel: () => {},
    nextLabel: "Continue to Review",
    submitLabel: "Deploy Garden",
    children: <MockStepContent stepIndex={0} />,
  },
};

// --- Two-step wizard ---

export const TwoStepWizard: Story = {
  args: {
    steps: twoSteps,
    currentStep: 1,
    onBack: () => {},
    onCancel: () => {},
    onSubmit: () => {},
    submitLabel: "Confirm & Deploy",
    children: <MockStepContent stepIndex={1} />,
  },
};

// --- Interactive full-flow ---

function InteractiveWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, mockSteps.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (index: number) => {
    if (index < currentStep) setCurrentStep(index);
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => setIsSubmitting(false), 2000);
  };

  const isLastStep = currentStep === mockSteps.length - 1;

  return (
    <FormWizard
      steps={mockSteps}
      currentStep={currentStep}
      onNext={!isLastStep ? handleNext : undefined}
      onBack={currentStep > 0 ? handleBack : undefined}
      onCancel={() => setCurrentStep(0)}
      onSubmit={isLastStep ? handleSubmit : undefined}
      onStepClick={handleStepClick}
      isSubmitting={isSubmitting}
    >
      <MockStepContent stepIndex={currentStep} />
    </FormWizard>
  );
}

export const FullFlow: Story = {
  render: () => <InteractiveWizard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify we start on step 1
    const stepIndicator = canvasElement.querySelector('[data-testid="step-indicator"]');
    await expect(stepIndicator).toBeTruthy();

    // Click Next to go to step 2
    const nextButton = canvas.getByRole("button", { name: /next/i });
    await userEvent.click(nextButton);

    // Verify Back button appears on step 2
    const backButton = canvas.getByRole("button", { name: /back/i });
    await expect(backButton).toBeVisible();
  },
};

// --- Gallery ---

export const Gallery: Story = {
  render: () => (
    <div className="space-y-12">
      <section>
        <h3 className="mb-4 px-4 text-sm font-medium text-text-sub">First Step</h3>
        <FormWizard steps={mockSteps} currentStep={0} onNext={() => {}} onCancel={() => {}}>
          <MockStepContent stepIndex={0} />
        </FormWizard>
      </section>

      <section>
        <h3 className="mb-4 px-4 text-sm font-medium text-text-sub">Middle Step with Back</h3>
        <FormWizard
          steps={mockSteps}
          currentStep={2}
          onNext={() => {}}
          onBack={() => {}}
          onCancel={() => {}}
        >
          <MockStepContent stepIndex={2} />
        </FormWizard>
      </section>

      <section>
        <h3 className="mb-4 px-4 text-sm font-medium text-text-sub">Last Step with Submit</h3>
        <FormWizard
          steps={mockSteps}
          currentStep={3}
          onBack={() => {}}
          onCancel={() => {}}
          onSubmit={() => {}}
        >
          <MockStepContent stepIndex={3} />
        </FormWizard>
      </section>

      <section>
        <h3 className="mb-4 px-4 text-sm font-medium text-text-sub">Validation Warning</h3>
        <FormWizard
          steps={mockSteps}
          currentStep={1}
          onNext={() => {}}
          onBack={() => {}}
          onCancel={() => {}}
          nextDisabled
          validationMessage="Please add at least one team member."
        >
          <MockStepContent stepIndex={1} />
        </FormWizard>
      </section>
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
};

export const DarkMode: Story = {
  args: {
    steps: mockSteps,
    currentStep: 1,
    onNext: () => {},
    onBack: () => {},
    onCancel: () => {},
    children: <MockStepContent stepIndex={1} />,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
