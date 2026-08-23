import {
  Alert,
  adminRoutes,
  getMinRequiredWorkImages,
  type SubmitWorkAuthSnapshot,
  TxInlineFeedback,
  useSubmitWorkController,
} from "@green-goods/shared";
import { RiSeedlingLine, RiUploadCloudLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import type { ActionFlowStep } from "@/components/Layout/ActionFlowStepper";
import { localizeActionForDisplay } from "@/views/Hub/actionDisplay";
import { SubmitWorkStepContent } from "./SubmitWorkStepContent";

export type SubmitWorkLayout = "page" | "dialog";

export interface SubmitWorkFlowProps {
  layout?: SubmitWorkLayout;
  onSuccess?: () => void;
  onCancel?: () => void;
  auth: SubmitWorkAuthSnapshot;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function SubmitWorkFlow({
  layout = "page",
  onSuccess,
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
    onSuccess,
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
    resetMutation,
    selectedAction,
    submitValidatedDraft,
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
          <p className="text-sm font-semibold text-text-strong">
            {formatMessage({ id: "app.admin.work.submit.noActionsForDomain" })}
          </p>
          <p className="max-w-sm text-xs text-text-sub">
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
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === stepConfigs.length;
  const nextDisabled = busy || (activeStepId === "action" && !selectedAction);
  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 space-y-1.5 sm:flex-1" aria-live="polite">
        {busy ? (
          <AdminLinearProgress
            ariaLabel={progressMessage || formatMessage({ id: "app.admin.work.submit.submitting" })}
          />
        ) : null}
        {progressMessage ? (
          <p className="truncate text-sm text-text-sub" title={progressMessage}>
            {progressMessage}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant={isFirstStep ? "text" : "outlined"}
          onClick={isFirstStep ? () => onCancel?.() : goBack}
          disabled={busy}
          className="self-start sm:self-auto"
        >
          {isFirstStep
            ? formatMessage({ id: "app.wizard.cancel", defaultMessage: "Cancel" })
            : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
        </AdminButton>
        {isLastStep ? (
          <AdminButton
            type="submit"
            form={formId}
            variant="filled"
            loading={busy}
            disabled={busy}
            onClick={armSubmitIntent}
            leadingIcon={<RiUploadCloudLine />}
            className="w-full sm:w-auto"
          >
            {formatMessage({ id: "app.admin.work.submit.submit" })}
          </AdminButton>
        ) : (
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => void goNext()}
            disabled={nextDisabled}
            className="w-full sm:w-auto"
          >
            {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
          </AdminButton>
        )}
      </div>
    </div>
  );

  return (
    <ActionFlowShell
      layout={layout}
      title={title}
      context={garden.name}
      steps={stepConfigs}
      currentStep={currentStep}
      onStepClick={handleStepJump}
      footer={footer}
    >
      <form id={formId} onSubmit={handleFormSubmit}>
        <div
          ref={phaseRef}
          tabIndex={-1}
          key={activeStepId}
          className="action-flow-fade space-y-4 outline-none"
        >
          {mutation.isError ? (
            <TxInlineFeedback
              visible
              severity="error"
              title={formatMessage({ id: "app.admin.work.submit.failureTitle" })}
              message={formatMessage({ id: "app.admin.work.submit.failureMessage" })}
              reserveClassName="min-h-0"
              action={
                <div className="flex flex-wrap gap-2">
                  <AdminButton
                    type="button"
                    variant="outlined"
                    size="sm"
                    onClick={() => void submitValidatedDraft()}
                    disabled={busy}
                  >
                    {formatMessage({ id: "app.admin.work.submit.retry" })}
                  </AdminButton>
                  <AdminButton
                    type="button"
                    variant="text"
                    size="sm"
                    onClick={resetMutation}
                    disabled={busy}
                  >
                    {formatMessage({ id: "app.admin.work.submit.editDetails" })}
                  </AdminButton>
                </div>
              }
            />
          ) : null}
          <SubmitWorkStepContent
            controller={controller}
            photoRequirementText={photoRequirementText}
          />
        </div>
      </form>
    </ActionFlowShell>
  );
}
