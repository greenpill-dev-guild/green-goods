import { Alert } from "@green-goods/shared/components/Alert";
import { ErrorBoundary } from "@green-goods/shared/components/ErrorBoundary/ErrorBoundary";
import { useCreateAssessmentController } from "@green-goods/shared/hooks/admin-ui/hub/useCreateAssessmentController";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useStepFocus } from "@green-goods/shared/hooks/utils/useStepFocus";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionsHarvestStep } from "@/components/Assessment/CreateAssessmentSteps/ActionsHarvestStep";
import { DomainContextStep } from "@/components/Assessment/CreateAssessmentSteps/DomainContextStep";
import { ReviewStep } from "@/components/Assessment/CreateAssessmentSteps/ReviewStep";
import { assessmentSendStatus } from "@/components/Assessment/CreateAssessmentSteps/reviewStatus";
import { StrategyKernelStep } from "@/components/Assessment/CreateAssessmentSteps/StrategyKernelStep";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowSendFooter, flowSendPhase, SingleSendNote } from "@/components/Layout/FlowSendFooter";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";

// Create Assessment is a create/commit flow rendered as a centered flow AdminDialog
// (full-width bottom-sheet on mobile, width from ADMIN_FLOW_DIALOG_CLASS) through the shared
// ActionFlowShell grammar, same as Submit Work. Single phase: no target selection,
// just the stacked configure sections, then the Review whose primary sends (DL-080).
export default function CreateAssessment() {
  const { formatMessage } = useIntl();
  const createAssessment = useCreateAssessmentController();
  const stepRef = useStepFocus<HTMLDivElement>(createAssessment.currentStep);
  // Confirm before an accidental X / scrim / Escape discards an in-progress
  // assessment. A sent assessment is not in progress: the controller reads it
  // as clean, so closing its done state never asks.
  const dirtyClose = useDirtyClose({
    isDirty: createAssessment.isDirty,
    onClose: createAssessment.handleClose,
    blockRouteChange: true,
    preventRouteChange: createAssessment.isSubmitting,
    onDiscard: createAssessment.handleDiscard,
  });

  // The dialog takes the name of the Hub action that opens it (Create
  // Assessment); the final button still reads Submit Assessment
  // (app.assessment.submitAssessment), the act it performs.
  const title = formatMessage({
    id: "cockpit.assessment.createTitle",
    defaultMessage: "Create Assessment",
  });

  // One reading of the send, so the status row and the footer never disagree.
  const status = assessmentSendStatus({
    phase: flowSendPhase({
      sending: createAssessment.isSubmitting,
      sent: createAssessment.isSent,
      failed: createAssessment.hasError,
    }),
    failure: {
      tone: createAssessment.txErrorView.severity,
      title: createAssessment.errorTitle,
      description: createAssessment.errorMessage,
    },
    formatMessage,
  });
  const { phase } = status;
  // While it sends, and once it is sent, no step reopens: the way on is Done.
  const editable = phase === "ready" || phase === "failed";

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
    review: (
      <ReviewStep
        form={createAssessment.reviewForm}
        steps={createAssessment.stepConfigs}
        status={status}
        onEditStep={createAssessment.goToStep}
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
    const activeStep = createAssessment.stepConfigs[createAssessment.currentStep];

    content = (
      <ActionFlowShell
        layout="dialog"
        title={title}
        context={createAssessment.garden.name}
        steps={createAssessment.stepConfigs}
        currentStep={createAssessment.currentStep + 1}
        complete={phase === "sent"}
        onStepClick={editable ? (step) => createAssessment.goToStep(step - 1) : undefined}
        footer={
          <FlowSendFooter
            stepIndex={createAssessment.currentStep}
            isLast={createAssessment.currentStep === createAssessment.stepConfigs.length - 1}
            phase={phase}
            sendLabel={formatMessage({
              id: "app.assessment.submitAssessment",
              defaultMessage: "Submit Assessment",
            })}
            note={<SingleSendNote phase={phase} />}
            another={{
              label: formatMessage({
                id: "app.assessment.createAnother",
                defaultMessage: "Create Another",
              }),
              onClick: createAssessment.handleCreateAnother,
            }}
            onCancel={createAssessment.handleClose}
            onBack={createAssessment.handleBack}
            onNext={createAssessment.handleNext}
            onSend={createAssessment.handleSubmit}
            onDone={createAssessment.handleClose}
          />
        }
      >
        <ErrorBoundary context="CreateAssessment.Wizard">
          <div ref={stepRef} tabIndex={-1} className="space-y-4 outline-none">
            {activeStep ? (
              <FlowStepHeader title={activeStep.title} description={activeStep.description} />
            ) : null}
            {activeStep ? stepRegistry[activeStep.id as keyof typeof stepRegistry] : null}
          </div>
        </ErrorBoundary>
      </ActionFlowShell>
    );
  }

  // Flow modal with a scrim (full-width bottom-sheet on mobile) — width comes
  // from ADMIN_FLOW_DIALOG_CLASS, not the size prop below. The body is
  // neutralized to a non-scrolling flex column so ActionFlowShell owns the
  // pinned chrome + scrolling body; the AdminDialog close button is the exit
  // (→ controller handleClose).
  return (
    <>
      <AdminDialog
        open
        size="lg"
        variant="flow"
        tone="hub"
        className={ADMIN_FLOW_DIALOG_CLASS}
        onOpenChange={dirtyClose.onOpenChange}
        preventClose={createAssessment.isSubmitting}
        title={title}
        description={formatMessage({
          id: "cockpit.assessment.createDescription",
          defaultMessage: "Describe the work, its goals, and the period it covers.",
        })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        {content}
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone="hub"
      />
    </>
  );
}
