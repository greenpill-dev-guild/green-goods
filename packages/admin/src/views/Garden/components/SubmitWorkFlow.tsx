import {
  type Domain,
  Alert,
  adminRoutes,
  FileUploadField,
  FormField,
  getMinRequiredWorkImages,
  NativeSelect,
  type SubmitWorkAuthSnapshot,
  Textarea,
  TxInlineFeedback,
  useSubmitWorkController,
  type useWorkForm,
  type WorkInput,
} from "@green-goods/shared";
import { RiSeedlingLine, RiUploadCloudLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminTextField } from "@/components/AdminTextField";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import type { ActionFlowStep } from "@/components/Layout/ActionFlowStepper";
import { localizeActionForDisplay } from "@/views/Hub/actionDisplay";
import { ActionChooserGrid } from "./ActionChooserGrid";
import { SubmitWorkReview } from "./SubmitWorkReview";

export type SubmitWorkLayout = "page" | "dialog";

export interface SubmitWorkFlowProps {
  layout?: SubmitWorkLayout;
  onSuccess?: () => void;
  onCancel?: () => void;
  auth: SubmitWorkAuthSnapshot;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}

const DOMAIN_TAB_KEYS: Record<Domain, string> = {
  0: "app.admin.assessment.domainAction.domain.solar",
  1: "app.admin.assessment.domainAction.domain.agroforestry",
  2: "app.admin.assessment.domainAction.domain.education",
  3: "app.admin.assessment.domainAction.domain.waste",
};

function DynamicWorkFields({
  inputs,
  control,
  register,
  errors,
}: {
  inputs: WorkInput[];
  control: ReturnType<typeof useWorkForm>["control"];
  register: ReturnType<typeof useWorkForm>["register"];
  errors: Record<string, { message?: string } | undefined>;
}) {
  const { formatMessage } = useIntl();
  if (inputs.length === 0) return null;

  return (
    <>
      {inputs.map((input) => {
        const error = errors[input.key]?.message;
        if (input.type === "number" || input.type === "text") {
          return (
            <AdminTextField
              key={input.key}
              label={input.title}
              id={input.key}
              type={input.type}
              variant="outlined"
              required={input.required}
              error={error}
              placeholder={input.placeholder}
              inputProps={input.type === "number" ? { step: "any", min: 0 } : undefined}
              {...register(input.key, input.type === "number" ? { valueAsNumber: true } : {})}
            />
          );
        }
        if (input.type === "textarea") {
          return (
            <FormField
              key={input.key}
              label={input.title}
              htmlFor={input.key}
              required={input.required}
              error={error}
            >
              <Textarea
                surface="admin"
                id={input.key}
                rows={3}
                placeholder={input.placeholder}
                aria-invalid={!!error}
                invalid={!!error}
                className="resize-y"
                {...register(input.key)}
              />
            </FormField>
          );
        }
        if (input.type === "select" || input.type === "band") {
          const options = input.type === "band" ? (input.bands ?? []) : (input.options ?? []);
          return (
            <FormField
              key={input.key}
              label={input.title}
              htmlFor={input.key}
              required={input.required}
              error={error}
            >
              <NativeSelect
                surface="admin"
                id={input.key}
                aria-invalid={!!error}
                invalid={!!error}
                {...register(input.key)}
              >
                <option value="">
                  {input.placeholder ||
                    formatMessage({ id: "app.admin.work.submit.selectActionPlaceholder" })}
                </option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          );
        }
        if (input.type !== "multi-select") return null;
        return (
          <Controller
            key={input.key}
            name={input.key}
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <FormField label={input.title} required={input.required} error={error}>
                <div className="flex flex-wrap gap-2">
                  {(input.options ?? []).map((option) => {
                    const current = Array.isArray(field.value)
                      ? field.value.filter((value): value is string => typeof value === "string")
                      : [];
                    const selected = current.includes(option);
                    return (
                      <AdminButton
                        key={option}
                        type="button"
                        variant={selected ? "tonal" : "outlined"}
                        size="sm"
                        onClick={() =>
                          field.onChange(
                            selected
                              ? current.filter((value: string) => value !== option)
                              : [...current, option]
                          )
                        }
                        className="rounded-full px-3 py-1"
                      >
                        {option}
                      </AdminButton>
                    );
                  })}
                </div>
              </FormField>
            )}
          />
        );
      })}
    </>
  );
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
    chooserDomains,
    currentStep,
    effectiveDomain,
    form,
    garden,
    goBack,
    goNext,
    goToStep,
    handleFilesChange,
    handleFormSubmit,
    handleSelectAction,
    handleStepJump,
    images,
    isAuthenticated,
    isLoadingData,
    mediaFeedback,
    mutation,
    phaseRef,
    progressMessage,
    removeImage,
    resetMutation,
    selectDomain,
    selectedAction,
    selectedActionId,
    submitValidatedDraft,
    visibleActions,
  } = controller;
  const { control, formState, getValues, register } = form;
  const { errors } = formState;
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

  let stepBody: ReactNode = null;
  if (activeStepId === "action") {
    stepBody = (
      <div className="space-y-4">
        <FlowStepHeader
          title={formatMessage({ id: "app.admin.work.submit.chooseActionTitle" })}
          description={formatMessage({ id: "app.admin.work.submit.chooseActionDescription" })}
        />
        {chooserDomains.length > 1 ? (
          <AdminTabRail
            ariaLabel={formatMessage({ id: "app.admin.assessment.domainAction.domainTitle" })}
            activeId={effectiveDomain === "all" ? "all" : String(effectiveDomain)}
            onChange={(id) => selectDomain(id === "all" ? "all" : (Number(id) as Domain))}
            tabs={[
              {
                id: "all",
                label: formatMessage({
                  id: "app.admin.work.submit.allActions",
                  defaultMessage: "All",
                }),
              },
              ...chooserDomains.map((domain) => ({
                id: String(domain),
                label: formatMessage({ id: DOMAIN_TAB_KEYS[domain] }),
                count: availableActions.filter((action) => action.domain === domain).length,
              })),
            ]}
          />
        ) : null}
        <p className="sr-only" aria-live="polite">
          {formatMessage(
            {
              id: "app.admin.work.submit.actionCount",
              defaultMessage:
                "{count, plural, one {# action available} other {# actions available}}",
            },
            { count: visibleActions.length }
          )}
        </p>
        <ActionChooserGrid
          actions={visibleActions}
          selectedActionId={selectedActionId}
          onSelect={handleSelectAction}
          disabled={busy}
          groupLabel={formatMessage({ id: "app.admin.work.submit.selectAction" })}
        />
      </div>
    );
  } else if (activeStepId === "media") {
    stepBody = (
      <div className="space-y-4">
        <FlowStepHeader
          title={
            selectedAction?.mediaInfo?.title ||
            formatMessage({ id: "app.admin.work.submit.section.photos" })
          }
          description={photoRequirementText}
        />
        <FileUploadField
          label={formatMessage({ id: "app.admin.work.submit.media" })}
          helpText={formatMessage({ id: "app.admin.work.submit.mediaHint" })}
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          multiple
          compress={false}
          showPreview
          currentFiles={images}
          onFilesChange={handleFilesChange}
          onRemoveFile={removeImage}
          disabled={busy}
        />
        {mediaFeedback ? (
          <Alert variant={mediaFeedback.variant}>{mediaFeedback.message}</Alert>
        ) : null}
      </div>
    );
  } else if (activeStepId === "details") {
    stepBody = (
      <div className="space-y-4">
        <FlowStepHeader
          title={
            selectedAction?.details?.title ||
            formatMessage({ id: "app.admin.work.submit.section.details" })
          }
          description={selectedAction?.title}
        />
        {selectedAction?.inputs.some((input) => input.required) ? (
          <p className="text-xs text-text-sub">
            {formatMessage({
              id: "app.admin.work.submit.requiredLegend",
              defaultMessage: "* Required field",
            })}
          </p>
        ) : null}
        {selectedAction && selectedAction.inputs.length > 0 ? (
          <DynamicWorkFields
            inputs={selectedAction.inputs}
            control={control}
            register={register}
            errors={errors as Record<string, { message?: string } | undefined>}
          />
        ) : null}
        <AdminTextField
          label={formatMessage({ id: "app.admin.work.submit.timeSpent" })}
          id="timeSpentMinutes"
          type="number"
          variant="outlined"
          error={errors.timeSpentMinutes?.message}
          helperText={formatMessage({ id: "app.admin.work.submit.timeSpentHint" })}
          placeholder={formatMessage({ id: "app.admin.work.submit.timeSpentPlaceholder" })}
          inputProps={{ step: "0.25", min: 0 }}
          {...register("timeSpentMinutes")}
        />
        <FormField
          label={formatMessage({ id: "app.admin.work.submit.feedback" })}
          htmlFor="feedback"
          error={errors.feedback?.message}
        >
          <Textarea
            surface="admin"
            id="feedback"
            rows={3}
            placeholder={formatMessage({ id: "app.admin.work.submit.feedbackPlaceholder" })}
            aria-invalid={!!errors.feedback}
            invalid={!!errors.feedback}
            className="resize-y"
            {...register("feedback")}
          />
        </FormField>
      </div>
    );
  } else if (selectedAction) {
    stepBody = (
      <SubmitWorkReview
        action={selectedAction}
        images={images}
        values={getValues() as Record<string, unknown>}
        photoRequirementText={photoRequirementText}
        onEditStep={goToStep}
      />
    );
  }

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
          {stepBody}
        </div>
      </form>
    </ActionFlowShell>
  );
}
