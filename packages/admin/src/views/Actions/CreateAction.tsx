import { ErrorBoundary } from "@green-goods/shared/components/ErrorBoundary/ErrorBoundary";
import { useCreateActionController } from "@green-goods/shared/hooks/admin-ui/actions/useCreateActionController";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useStepFocus } from "@green-goods/shared/hooks/utils/useStepFocus";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import {
  BasicsStep,
  CapitalsStep,
  InstructionsStep,
  ReviewStep,
} from "@/components/Action/CreateActionSteps";
import { actionSendStatus } from "@/components/Action/CreateActionSteps/reviewStatus";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowSendFooter, flowSendPhase, SingleSendNote } from "@/components/Layout/FlowSendFooter";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";

// Create Action is a create/commit flow rendered as a centered flow AdminDialog
// (full-width bottom-sheet on mobile, width from ADMIN_FLOW_DIALOG_CLASS) through
// the shared ActionFlowShell grammar — same as Submit Work, Create Assessment,
// and Create Hypercert. The controller already owns the four-step machinery
// (currentStep / handleNext / handleBack / goToStep); this view just drives it.
// It ends on the Review whose primary sends, and stays there once the action
// is registered (DL-080).
export default function CreateAction() {
  const { formatMessage } = useIntl();
  const createAction = useCreateActionController();
  const stepRef = useStepFocus<HTMLDivElement>(createAction.currentStep);

  // Confirm before an accidental X / scrim / Escape discards an in-progress
  // action. The explicit footer Cancel still exits directly (keeping the draft
  // for resume); this only guards the dialog's own close affordances. A
  // registered action is not in progress: the controller reads it as clean, so
  // closing its done state never asks.
  const dirtyClose = useDirtyClose({
    isDirty: createAction.isDirty,
    onClose: createAction.handleCancel,
    blockRouteChange: true,
    preventRouteChange: createAction.isSending,
    onDiscard: createAction.handleDiscard,
  });

  const title = formatMessage({
    id: "admin.actions.createAction",
    defaultMessage: "Create Action",
  });

  // One reading of the send, so the status row and the footer never disagree.
  const status = actionSendStatus({
    pending: createAction.isPendingRegistration,
    phase: flowSendPhase({
      sending: createAction.isSending,
      sent: createAction.isSent,
      failed: createAction.hasError,
    }),
    failure: {
      tone: createAction.txErrorView.severity,
      title: createAction.errorTitle,
      description: createAction.errorMessage,
    },
    formatMessage,
  });
  const { phase } = status;
  // While it sends, and once it is sent, no step reopens: the way on is Done.
  const editable = phase === "ready" || phase === "failed";

  const stepRegistry = {
    basics: <BasicsStep form={createAction.form} domainOptions={createAction.domainOptions} />,
    capitals: <CapitalsStep form={createAction.form} />,
    instructions: <InstructionsStep form={createAction.form} />,
    review: (
      <ReviewStep
        form={createAction.form}
        domainOptions={createAction.domainOptions}
        status={status}
      />
    ),
  };

  const activeStep = createAction.stepConfigs[createAction.currentStep];

  const footer = createAction.isPendingRegistration ? (
    <AdminButton
      type="button"
      disabled={createAction.isCheckingConfirmation}
      onClick={() => void createAction.checkConfirmation()}
    >
      {formatMessage({ id: "app.account.checkConfirmation", defaultMessage: "Check confirmation" })}
    </AdminButton>
  ) : (
    <FlowSendFooter
      stepIndex={createAction.currentStep}
      isLast={createAction.currentStep === createAction.stepConfigs.length - 1}
      phase={phase}
      sendLabel={title}
      note={<SingleSendNote phase={phase} />}
      another={{
        label: formatMessage({
          id: "app.admin.actions.create.createAnother",
          defaultMessage: "Create Another",
        }),
        onClick: createAction.handleCreateAnother,
      }}
      onCancel={createAction.handleCancel}
      onBack={createAction.handleBack}
      onNext={createAction.handleNext}
      onSend={createAction.form.handleSubmit(createAction.onSubmit)}
      onDone={createAction.handleCancel}
    />
  );

  const content: ReactNode = (
    <ActionFlowShell
      layout="dialog"
      title={title}
      steps={createAction.stepConfigs}
      currentStep={createAction.currentStep + 1}
      complete={phase === "sent"}
      onStepClick={editable ? (step) => createAction.goToStep(step - 1) : undefined}
      footer={footer}
    >
      <ErrorBoundary context="CreateAction.Wizard">
        <div ref={stepRef} tabIndex={-1} className="space-y-4 outline-none">
          {activeStep ? (
            <FlowStepHeader title={activeStep.title} description={activeStep.description} />
          ) : null}
          {activeStep ? stepRegistry[activeStep.id as keyof typeof stepRegistry] : null}
        </div>
      </ErrorBoundary>
    </ActionFlowShell>
  );

  // Flow modal with a scrim (full-width bottom-sheet on mobile) — width comes from
  // ADMIN_FLOW_DIALOG_CLASS, not the size prop. The body is neutralized to a
  // non-scrolling flex column so ActionFlowShell owns the pinned chrome +
  // scrolling body; the AdminDialog close button routes through the discard guard.
  return (
    <>
      <AdminDialog
        open
        size="lg"
        variant="flow"
        tone="actions"
        className={ADMIN_FLOW_DIALOG_CLASS}
        onOpenChange={dirtyClose.onOpenChange}
        preventClose={createAction.isSending}
        title={title}
        description={formatMessage({
          id: "cockpit.actions.createDescription",
          defaultMessage:
            "Define the registry record, timeline, and submission requirements for a new action.",
        })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        {content}
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone="actions"
      />
    </>
  );
}
