import {
  Alert,
  ErrorBoundary,
  TxInlineFeedback,
  useCreateAssessmentController,
} from "@green-goods/shared";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { ActionsHarvestStep } from "@/components/Assessment/CreateAssessmentSteps/ActionsHarvestStep";
import { DomainContextStep } from "@/components/Assessment/CreateAssessmentSteps/DomainContextStep";
import { StrategyKernelStep } from "@/components/Assessment/CreateAssessmentSteps/StrategyKernelStep";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";

// Create Assessment is a create/commit flow rendered as a centered 2xl AdminDialog
// (bottom-sheet on mobile) through the shared ActionFlowShell grammar, same as
// Submit Work. Single phase: no target selection, just the stacked configure sections.
export default function CreateAssessment() {
  const { formatMessage } = useIntl();
  const createAssessment = useCreateAssessmentController();

  const title = formatMessage({
    id: "app.assessment.submitAssessment",
    defaultMessage: "Submit assessment",
  });

  const stepRegistry = {
    domainContext: (
      <DomainContextStep
        showValidation={createAssessment.showValidation}
        isSubmitting={createAssessment.isSubmitting}
        gardenDomainMask={createAssessment.normalizedGardenDomainMask}
      />
    ),
    strategy: (
      <StrategyKernelStep
        showValidation={createAssessment.showValidation}
        isSubmitting={createAssessment.isSubmitting}
      />
    ),
    actionsHarvest: (
      <ActionsHarvestStep
        showValidation={createAssessment.showValidation}
        isSubmitting={createAssessment.isSubmitting}
      />
    ),
  };

  let content: ReactNode;
  if (!createAssessment.garden) {
    content = (
      <ActionFlowShell layout="dialog" title={title}>
        <Alert variant="error">{formatMessage({ id: "app.garden.admin.notFound" })}</Alert>
      </ActionFlowShell>
    );
  } else if (!createAssessment.canReview) {
    content = (
      <ActionFlowShell layout="dialog" title={title} context={createAssessment.garden.name}>
        <Alert variant="warning">{formatMessage({ id: "app.admin.auth.noPermission" })}</Alert>
      </ActionFlowShell>
    );
  } else {
    const isFirstStep = createAssessment.currentStep === 0;
    const isLastStep = createAssessment.currentStep === createAssessment.stepConfigs.length - 1;
    const activeStep = createAssessment.stepConfigs[createAssessment.currentStep];

    const feedbackNode = createAssessment.hasError ? (
      <TxInlineFeedback
        visible
        severity={createAssessment.txErrorView.severity}
        title={createAssessment.errorTitle}
        message={createAssessment.errorMessage}
        reserveClassName="min-h-0"
        action={
          <div className="flex flex-wrap gap-2">
            <AdminButton
              type="button"
              variant="outlined"
              size="sm"
              onClick={createAssessment.retry}
              disabled={!createAssessment.canRetry || createAssessment.isSubmitting}
            >
              {formatMessage({
                id: "app.assessment.retrySubmission",
                defaultMessage: "Retry submission",
              })}
            </AdminButton>
            <AdminButton
              type="button"
              variant="text"
              size="sm"
              onClick={() => createAssessment.resetWorkflow()}
            >
              {formatMessage({
                id: "app.assessment.editDetails",
                defaultMessage: "Edit details",
              })}
            </AdminButton>
          </div>
        }
      />
    ) : null;

    const footer = (
      // Mobile: status on top, compact secondary, full-width primary CTA.
      // Desktop: status left, button pair right. SheetFooter is a fixed
      // inline-flex row, so this single w-full child owns the responsive layout.
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 sm:flex-1" aria-live="polite">
          {createAssessment.isSubmitting ? <AdminLinearProgress ariaLabel={title} /> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <AdminButton
            type="button"
            variant={isFirstStep ? "text" : "outlined"}
            onClick={isFirstStep ? createAssessment.handleCancel : createAssessment.handleBack}
            disabled={createAssessment.isSubmitting}
            className="self-start sm:self-auto"
          >
            {isFirstStep
              ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
              : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
          </AdminButton>
          {isLastStep ? (
            <AdminButton
              type="button"
              variant="filled"
              onClick={createAssessment.handleSubmit}
              loading={createAssessment.isSubmitting}
              disabled={createAssessment.isSubmitting}
              className="w-full sm:w-auto"
            >
              {formatMessage({
                id: "app.assessment.submitAssessment",
                defaultMessage: "Submit assessment",
              })}
            </AdminButton>
          ) : (
            <AdminButton
              type="button"
              variant="filled"
              onClick={createAssessment.handleNext}
              disabled={createAssessment.isSubmitting}
              className="w-full sm:w-auto"
            >
              {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
            </AdminButton>
          )}
        </div>
      </div>
    );

    content = (
      <ActionFlowShell
        layout="dialog"
        title={title}
        context={createAssessment.garden.name}
        steps={createAssessment.stepConfigs}
        currentStep={createAssessment.currentStep + 1}
        footer={footer}
      >
        <ErrorBoundary context="CreateAssessment.Wizard">
          <div className="space-y-4">
            {activeStep ? (
              <div>
                <h2 className="text-base font-semibold text-text-strong">{activeStep.title}</h2>
                {activeStep.description ? (
                  <p className="mt-0.5 text-sm text-text-soft">{activeStep.description}</p>
                ) : null}
              </div>
            ) : null}
            {feedbackNode}
            {activeStep ? stepRegistry[activeStep.id as keyof typeof stepRegistry] : null}
          </div>
        </ErrorBoundary>
      </ActionFlowShell>
    );
  }

  // Centered 2xl modal with a scrim (bottom-sheet on mobile). The body is
  // neutralized to a non-scrolling flex column so ActionFlowShell owns the
  // pinned chrome + scrolling body; the AdminDialog close button is the exit
  // (→ controller handleCancel).
  return (
    <AdminDialog
      open
      size="2xl"
      variant="flow"
      tone="hub"
      className="min-h-[90dvh] sm:min-h-0 sm:!max-w-3xl lg:!max-w-5xl"
      onOpenChange={(next) => {
        if (!next) createAssessment.handleCancel();
      }}
      title={title}
      description={formatMessage({
        id: "cockpit.assessment.createDescription",
        defaultMessage:
          "Capture the context, strategy kernel, and harvest window for a new assessment.",
      })}
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      {content}
    </AdminDialog>
  );
}
