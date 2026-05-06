import { Button } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FormFlow, toFormFlowSections } from "@/components/Layout/FormFlow";

// VISUAL HARNESS — not the real HypercertWizard.
// The real flow depends on `useWizardData`, which reads attestations,
// assessments, draft persistence, and a full mint mutation. This harness
// renders the admin non-wizard form layout with placeholder sections so
// reviewers can inspect local actions without body-level footer chrome.

const WIZARD_STEPS = [
  { id: "attestations", label: "Select attestations" },
  { id: "metadata", label: "Metadata" },
  { id: "distribution", label: "Distribution" },
  { id: "preview", label: "Review & mint" },
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
  const highlightedStep = WIZARD_STEPS[initialStep] ?? WIZARD_STEPS[0];
  const sectionContent = Object.fromEntries(
    WIZARD_STEPS.map((step) => [step.id, <StepPlaceholder key={step.id} label={step.label} />])
  );

  return (
    <FormFlow
      sections={toFormFlowSections(
        WIZARD_STEPS.map((s) => ({
          id: s.id,
          title: s.label,
          description:
            s.id === highlightedStep.id ? "Highlighted review section" : "Continuous section",
        })),
        sectionContent
      )}
      feedback={
        nextDisabled && validationMessage ? (
          <div className="rounded-[var(--radius-lg)] border border-warning-light bg-warning-lighter px-3 py-2 text-sm text-warning-dark">
            {validationMessage}
          </div>
        ) : undefined
      }
      actions={
        <>
          <Button type="button" variant="secondary" onClick={fn()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={fn()} disabled={nextDisabled} loading={isSubmitting}>
            Mint hypercert
          </Button>
        </>
      }
    />
  );
}

const meta: Meta<typeof HypercertWizardHarness> = {
  title: "Admin/Workflows/Hypercerts/HypercertWizard",
  component: HypercertWizardHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "Visual harness — not the real `HypercertWizard`. Renders the admin non-wizard form layout with placeholder section content so reviewers can inspect local actions and continuous form anatomy. The real flow composes `AttestationSelector`, `MetadataEditor`, `DistributionConfig`, and `HypercertPreview` — each has its own story.",
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
