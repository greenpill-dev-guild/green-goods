import { Alert } from "@green-goods/shared/components/Alert";
import {
  getMinRequiredWorkImages,
  type SubmitWorkAuthSnapshot,
  useSubmitWorkController,
} from "@green-goods/shared/hooks/admin-ui/garden/useSubmitWorkController";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiSeedlingLine, RiUploadCloudLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import type { ActionFlowStep } from "@/components/Layout/ActionFlowStepper";
import { FlowSendFooter, flowSendPhase, SingleSendNote } from "@/components/Layout/FlowSendFooter";
import { localizeActionForDisplay } from "@/views/Hub/actionDisplay";
import { SubmitWorkStepContent } from "./SubmitWorkStepContent";
import { submitWorkSendStatus } from "./submitWorkStatus";

export type SubmitWorkLayout = "page" | "dialog";

export interface SubmitWorkFlowProps {
  layout?: SubmitWorkLayout;
  /** The steward leaves the done state: the work is sent and the flow can close. */
  onDone?: () => void;
  onCancel?: () => void;
  auth: SubmitWorkAuthSnapshot;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function SubmitWorkFlow({
  layout = "page",
  onDone,
  onCancel,
  onDirtyChange,
  onBusyChange,
  auth,
}: SubmitWorkFlowProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const controller = useSubmitWorkController({
    auth,
    localizeAction: localizeActionForDisplay,
    onDirtyChange,
    onBusyChange,
  });
  const {
    activeStepId,
    availableActions,
    armSubmitIntent,
    busy,
    canSubmit,
    currentStep,
    garden,
    goBack,
    goNext,
    handleFormSubmit,
    handleStepJump,
    isAuthenticated,
    isLoadingData,
    mutation,
    phaseRef,
    progressMessage,
    selectedAction,
    sent,
    submitAnother,
  } = controller;
  const title = formatMessage({ id: "app.admin.work.submit.title" });
  const exitLabel = formatMessage({ id: "app.admin.work.submit.backToGarden" });
  const exitBack = layout === "page" ? () => onCancel?.() : undefined;

  if (isLoadingData) {
    return (
      <ActionFlowShell layout={layout} title={title}>
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">{formatMessage({ id: "app.admin.work.submit.loading" })}</span>
          <div className="h-7 w-2/3 rounded-lg skeleton-shimmer" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-28 rounded-lg skeleton-shimmer"
                style={{ animationDelay: `${index * 0.05}s` }}
              />
            ))}
          </div>
        </div>
      </ActionFlowShell>
    );
  }
  if (!garden) {
    return (
      <ActionFlowShell layout={layout} title={title} onBack={exitBack} backLabel={exitLabel}>
        <Alert variant="error">{formatMessage({ id: "app.garden.admin.notFound" })}</Alert>
      </ActionFlowShell>
    );
  }
  if (!isAuthenticated || !canSubmit) {
    return (
      <ActionFlowShell
        layout={layout}
        title={title}
        context={garden.name}
        onBack={exitBack}
        backLabel={exitLabel}
      >
        <Alert variant="warning">
          {formatMessage({
            id: isAuthenticated
              ? "app.admin.work.submit.noPermission"
              : "app.admin.work.submit.connectWallet",
          })}
        </Alert>
      </ActionFlowShell>
    );
  }
  if (availableActions.length === 0) {
    return (
      <ActionFlowShell
        layout={layout}
        title={title}
        context={garden.name}
        onBack={exitBack}
        backLabel={exitLabel}
      >
        <div className="flex flex-col items-center gap-3 rounded-lg border border-stroke-soft bg-bg-white p-8 text-center">
          <RiSeedlingLine className="h-10 w-10 text-text-soft" aria-hidden="true" />
          <p className="body-sm font-semibold text-text-strong">
            {formatMessage({ id: "app.admin.work.submit.noActionsForDomain" })}
          </p>
          <p className="max-w-sm body-xs text-text-sub">
            {formatMessage({ id: "app.admin.work.submit.noActionsForDomainHint" })}
          </p>
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => navigate(adminRoutes.gardenSettings({ gardenId: garden.id }))}
          >
            {formatMessage({ id: "app.admin.work.submit.noActionsForDomain.cta" })}
          </AdminButton>
        </div>
      </ActionFlowShell>
    );
  }

  const formId = "submit-work-form";
  const photoRequirementText = selectedAction?.mediaInfo?.required
    ? formatMessage(
        { id: "app.admin.work.submit.photosRequired" },
        { count: getMinRequiredWorkImages(selectedAction) }
      )
    : formatMessage({ id: "app.admin.work.submit.photosOptional" });
  const stepConfigs: ActionFlowStep[] = [
    {
      id: "action",
      title: formatMessage({ id: "app.admin.work.submit.step.action", defaultMessage: "Action" }),
      description: formatMessage({
        id: "app.admin.work.submit.step.action.hint",
        defaultMessage: "Choose what work to log",
      }),
    },
    {
      id: "media",
      title: formatMessage({ id: "app.admin.work.submit.step.media", defaultMessage: "Media" }),
      description: formatMessage({
        id: "app.admin.work.submit.step.media.hint",
        defaultMessage: "Add photos of the work",
      }),
    },
    {
      id: "details",
      title: formatMessage({ id: "app.admin.work.submit.step.details", defaultMessage: "Details" }),
      description: formatMessage({
        id: "app.admin.work.submit.step.details.hint",
        defaultMessage: "Fill in the action's fields",
      }),
    },
    {
      id: "review",
      title: formatMessage({ id: "app.admin.work.submit.step.review", defaultMessage: "Review" }),
      description: formatMessage({
        id: "app.admin.work.submit.step.review.hint",
        defaultMessage: "Check everything before submitting",
      }),
    },
  ];
  const awaitingConfirmation = mutation.lastSubmissionOutcome?.kind === "awaiting-confirmation";
  // One reading of the send, so the status row and the footer never disagree.
  const status = submitWorkSendStatus({
    awaitingConfirmation,
    phase: flowSendPhase({ sending: mutation.isPending, sent, failed: mutation.isError }),
    progressMessage,
    formatMessage,
  });
  const { phase } = status;
  const footer = (
    <FlowSendFooter
      stepIndex={currentStep - 1}
      isLast={currentStep === stepConfigs.length}
      phase={phase}
      sendLabel={
        awaitingConfirmation
          ? formatMessage({
              id: "app.admin.work.submit.checkConfirmation",
              defaultMessage: "Check confirmation",
            })
          : formatMessage({ id: "app.admin.work.submit.submit" })
      }
      // The Review's primary submits the form, which validates once more before it sends.
      sendButtonProps={{ type: "submit", form: formId, leadingIcon: <RiUploadCloudLine /> }}
      note={awaitingConfirmation ? status.description : <SingleSendNote phase={phase} />}
      nextDisabled={activeStepId === "action" && !selectedAction}
      held={busy}
      another={{
        label: formatMessage({
          id: "app.admin.work.submit.another",
          defaultMessage: "Submit Another",
        }),
        onClick: submitAnother,
      }}
      onCancel={() => onCancel?.()}
      onBack={goBack}
      onNext={() => void goNext()}
      onSend={armSubmitIntent}
      onDone={() => onDone?.()}
    />
  );

  return (
    <ActionFlowShell
      layout={layout}
      title={title}
      context={garden.name}
      steps={stepConfigs}
      currentStep={currentStep}
      complete={sent}
      // Once the work is sent no step reopens: the way on is Done.
      onStepClick={sent ? undefined : handleStepJump}
      footer={footer}
    >
      <form id={formId} onSubmit={handleFormSubmit}>
        <div
          ref={phaseRef}
          tabIndex={-1}
          key={activeStepId}
          className="action-flow-fade space-y-4 outline-none"
        >
          <SubmitWorkStepContent
            controller={controller}
            photoRequirementText={photoRequirementText}
            reviewStatus={status}
          />
        </div>
      </form>
    </ActionFlowShell>
  );
}
