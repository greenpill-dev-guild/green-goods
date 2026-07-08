import {
  ErrorBoundary,
  useCreateActionController,
  useDirtyClose,
  useStepFocus,
} from "@green-goods/shared";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import {
  BasicsStep,
  CapitalsStep,
  InstructionsStep,
  ReviewStep,
} from "@/components/Action/CreateActionSteps";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";

// Create Action is a create/commit flow rendered as a centered flow AdminDialog
// (full-width bottom-sheet on mobile, width from ADMIN_FLOW_DIALOG_CLASS) through
// the shared ActionFlowShell grammar — same as Submit Work, Create Assessment,
// and Create Hypercert. The controller already owns the four-step machinery
// (currentStep / handleNext / handleBack / goToStep); this view just drives it.
export default function CreateAction() {
  const { formatMessage } = useIntl();
  const createAction = useCreateActionController();
  const stepRef = useStepFocus<HTMLDivElement>(createAction.currentStep);

  // Confirm before an accidental X / scrim / Escape discards an in-progress
  // action. The explicit footer Cancel still exits directly (keeping the draft
  // for resume); this only guards the dialog's own close affordances.
  const dirtyClose = useDirtyClose({
    isDirty: createAction.isDirty,
    onClose: createAction.handleCancel,
    blockRouteChange: true,
    preventRouteChange: createAction.isLoading,
    onDiscard: createAction.handleDiscard,
  });

  const title = formatMessage({
    id: "admin.actions.createAction",
    defaultMessage: "Create action",
  });

  const stepRegistry = {
    basics: <BasicsStep form={createAction.form} domainOptions={createAction.domainOptions} />,
    capitals: <CapitalsStep form={createAction.form} />,
    instructions: <InstructionsStep form={createAction.form} />,
    review: <ReviewStep form={createAction.form} domainOptions={createAction.domainOptions} />,
  };

  const isFirstStep = createAction.currentStep === 0;
  const isLastStep = createAction.currentStep === createAction.stepConfigs.length - 1;
  const activeStep = createAction.stepConfigs[createAction.currentStep];

  const footer = (
    // Mobile: status on top, compact secondary, full-width primary CTA.
    // Desktop: status left, button pair right. SheetFooter is a fixed inline-flex
    // row, so this single w-full child owns the responsive layout.
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:flex-1" aria-live="polite">
        {createAction.isLoading ? <AdminLinearProgress ariaLabel={title} /> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant={isFirstStep ? "text" : "outlined"}
          onClick={isFirstStep ? createAction.handleCancel : createAction.handleBack}
          disabled={createAction.isLoading}
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
            onClick={createAction.form.handleSubmit(createAction.onSubmit)}
            loading={createAction.isLoading}
            disabled={createAction.isLoading}
            className="w-full sm:w-auto"
          >
            {formatMessage({
              id: "admin.actions.createAction",
              defaultMessage: "Create action",
            })}
          </AdminButton>
        ) : (
          <AdminButton
            type="button"
            variant="filled"
            onClick={createAction.handleNext}
            disabled={createAction.isLoading}
            className="w-full sm:w-auto"
          >
            {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
          </AdminButton>
        )}
      </div>
    </div>
  );

  const content: ReactNode = (
    <ActionFlowShell
      layout="dialog"
      title={title}
      steps={createAction.stepConfigs}
      currentStep={createAction.currentStep + 1}
      onStepClick={(step) => {
        if (!createAction.isLoading) createAction.goToStep(step - 1);
      }}
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
        preventClose={createAction.isLoading}
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
