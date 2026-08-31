import { Alert } from "@green-goods/shared/components/Alert";
import { FileUploadField } from "@green-goods/shared/components/FileUploadField";
import type { SubmitWorkController } from "@green-goods/shared/hooks/admin-ui/garden/useSubmitWorkController";
import type { Domain } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import { ActionChooserGrid } from "./ActionChooserGrid";
import { SubmitWorkFields } from "./SubmitWorkFields";
import { SubmitWorkReview } from "./SubmitWorkReview";

const DOMAIN_TAB_KEYS: Record<Domain, string> = {
  0: "app.admin.assessment.domainAction.domain.solar",
  1: "app.admin.assessment.domainAction.domain.agroforestry",
  2: "app.admin.assessment.domainAction.domain.education",
  3: "app.admin.assessment.domainAction.domain.waste",
};

export function SubmitWorkStepContent({
  controller,
  photoRequirementText,
}: {
  controller: SubmitWorkController;
  photoRequirementText: string;
}) {
  const { formatMessage } = useIntl();
  const {
    activeStepId,
    availableActions,
    busy,
    chooserDomains,
    effectiveDomain,
    form,
    goToStep,
    handleFilesChange,
    handleSelectAction,
    images,
    mediaFeedback,
    removeImage,
    selectDomain,
    selectedAction,
    selectedActionId,
    visibleActions,
  } = controller;
  const { control, formState, getValues, register } = form;
  const { errors } = formState;

  if (activeStepId === "action") {
    return (
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
  }
  if (activeStepId === "media") {
    return (
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
  }
  if (activeStepId === "details") {
    return (
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
          <SubmitWorkFields
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
          error={errors.timeSpentMinutes?.message}
          helperText={formatMessage({ id: "app.admin.work.submit.timeSpentHint" })}
          placeholder={formatMessage({ id: "app.admin.work.submit.timeSpentPlaceholder" })}
          inputProps={{ step: "0.25", min: 0 }}
          {...register("timeSpentMinutes")}
        />
        <AdminTextArea
          label={formatMessage({ id: "app.admin.work.submit.feedback" })}
          id="feedback"
          rows={3}
          error={errors.feedback?.message}
          placeholder={formatMessage({ id: "app.admin.work.submit.feedbackPlaceholder" })}
          {...register("feedback")}
        />
      </div>
    );
  }
  return selectedAction ? (
    <SubmitWorkReview
      action={selectedAction}
      images={images}
      values={getValues() as Record<string, unknown>}
      photoRequirementText={photoRequirementText}
      onEditStep={goToStep}
    />
  ) : null;
}
