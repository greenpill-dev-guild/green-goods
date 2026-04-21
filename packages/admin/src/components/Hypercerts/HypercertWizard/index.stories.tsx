import { FormWizard } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";

// ⚠ VISUAL HARNESS — not the real HypercertWizard.
// The real wizard depends on `useWizardData`, which reads attestations,
// assessments, draft persistence, and a full mint mutation — none of
// which are reviewable in isolation. This harness wraps the shared
// `FormWizard` with placeholder steps so reviewers can inspect the
// step chrome / navigation / submit lifecycle. Review the real step
// panels under `Admin/Workflows/Hypercerts/Steps/*`.

const WIZARD_STEPS = [
  { id: "attestations", label: "Select attestations" },
  { id: "metadata", label: "Metadata" },
  { id: "distribution", label: "Distribution" },
  { id: "review", label: "Review & mint" },
] as const;

interface HypercertWizardHarnessProps {
  initialStep?: number;
  isSubmitting?: boolean;
  nextDisabled?: boolean;
  validationMessage?: string | null;
}

function StepPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stroke-soft p-10 text-center">
      <p className="text-sm text-text-sub">
        Inspect the full step views under{" "}
        <span className="font-medium text-text-strong">
          Admin / Workflows / Hypercerts / Steps / *
        </span>
      </p>
      <p className="mt-2 text-xs text-text-soft">Current step: {label}</p>
    </div>
  );
}

function HypercertWizardHarness({
  initialStep = 0,
  isSubmitting = false,
  nextDisabled = false,
  validationMessage = null,
}: HypercertWizardHarnessProps) {
  const [step, setStep] = useState(initialStep);
  const current = WIZARD_STEPS[step];

  return (
    <FormWizard
      steps={WIZARD_STEPS.map((s) => ({ id: s.id, title: s.label }))}
      currentStep={step}
      onNext={() => setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))}
      onBack={() => setStep((s) => Math.max(s - 1, 0))}
      onCancel={fn()}
      onSubmit={fn()}
      onStepClick={(i) => setStep(i)}
      nextDisabled={nextDisabled}
      validationMessage={validationMessage ?? undefined}
      isSubmitting={isSubmitting}
      nextLabel="Next"
      submitLabel="Mint hypercert"
    >
      <StepPlaceholder label={current.label} />
    </FormWizard>
  );
}

const meta: Meta<typeof HypercertWizardHarness> = {
  title: "Admin/Workflows/Hypercerts/HypercertWizard",
  component: HypercertWizardHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `HypercertWizard`. Renders the shared `FormWizard` shell with placeholder step content so reviewers can inspect the step chrome / navigation / submit lifecycle. The real wizard composes `AttestationSelector`, `MetadataEditor`, `DistributionConfig`, and `HypercertPreview` — each has its own story.",
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    initialStep: {
      control: { type: "number", min: 0, max: 3 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof HypercertWizardHarness>;

export const StepOne: Story = {
  args: { initialStep: 0 },
};

export const StepThree: Story = {
  args: { initialStep: 2 },
};

export const FinalStep: Story = {
  args: { initialStep: 3 },
};

export const BlockedWithValidation: Story = {
  args: {
    initialStep: 1,
    nextDisabled: true,
    validationMessage: "Title and work scope are required before continuing.",
  },
};

export const Submitting: Story = {
  args: { initialStep: 3, isSubmitting: true },
};
