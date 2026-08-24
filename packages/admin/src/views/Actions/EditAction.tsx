import { useActionEditorController } from "@green-goods/shared/hooks/admin-ui/actions/useActionEditorController";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@green-goods/shared/utils/time";
import { useIntl } from "react-intl";
import { InstructionsBuilder } from "@/components/Action/InstructionsBuilder";
import { ActionTranslationEditor } from "@/components/Action/ActionTranslationEditor";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminTextField } from "@/components/AdminTextField";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";

interface EditActionProps {
  layout?: "page" | "sheet";
}

export default function EditAction({ layout = "page" }: EditActionProps = {}) {
  const { formatMessage } = useIntl();
  const {
    action,
    actionDetailHref,
    actionsListHref,
    actionsLoading,
    cancel,
    form,
    instructionConfig,
    isEditingInstructions,
    isLoading,
    isLoadingInstructions,
    setInstructionConfig,
    setIsEditingInstructions,
    setTranslations,
    setTranslationsDirty,
    submit,
    translations,
  } = useActionEditorController();

  if (actionsLoading) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-5xl"
          title={formatMessage({ id: "app.actions.loading" })}
          description={formatMessage({
            id: "cockpit.actions.editDescription",
            defaultMessage: "Update lifecycle details and the submission contract for this action.",
          })}
          variant="canvas"
          sticky
        />
        <CanvasRouteContent maxWidthClassName="max-w-5xl" className="mt-4">
          <AdminCard role="status" aria-live="polite">
            <p className="text-text-sub">{formatMessage({ id: "app.actions.loading" })}</p>
          </AdminCard>
        </CanvasRouteContent>
      </CanvasRouteFrame>
    );
  }

  if (!action) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-5xl"
          title={formatMessage({ id: "app.actions.notFound" })}
          description={formatMessage({
            id: "cockpit.actions.editDescription",
            defaultMessage: "Update lifecycle details and the submission contract for this action.",
          })}
          variant="canvas"
          backLink={{
            to: actionsListHref,
            label: formatMessage({
              id: "app.actions.backToActions",
              defaultMessage: "Back to actions",
            }),
          }}
          sticky
        />
        <CanvasRouteContent maxWidthClassName="max-w-5xl" className="mt-4">
          <AdminCard className="text-center">
            <p className="text-text-sub">{formatMessage({ id: "app.actions.notFound" })}</p>
          </AdminCard>
        </CanvasRouteContent>
      </CanvasRouteFrame>
    );
  }

  const formContent = (
    <CanvasRouteContent
      maxWidthClassName={layout === "sheet" ? "max-w-none" : "max-w-5xl"}
      className={layout === "sheet" ? "p-4" : "mt-4"}
    >
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <AdminCard className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-text-strong">
              {formatMessage({ id: "app.actions.edit.basicInfo" })}
            </h3>
            <p className="mt-1 text-sm text-text-sub">
              {formatMessage({
                id: "cockpit.actions.detailDescription",
                defaultMessage:
                  "Review lifecycle details and the submission requirements for this action.",
              })}
            </p>
          </div>
          <div className="space-y-4">
            <AdminTextField
              label={formatMessage({ id: "app.assessment.table.title" })}
              id="action-title"
              variant="outlined"
              error={form.formState.errors.title?.message}
              {...form.register("title")}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminTextField
                label={formatMessage({ id: "app.actions.detail.startTime" })}
                id="action-start-time"
                type="datetime-local"
                variant="outlined"
                value={toDateTimeLocalValue(form.watch("startTime").getTime())}
                onChange={(e) => form.setValue("startTime", fromDateTimeLocalValue(e.target.value))}
              />

              <AdminTextField
                label={formatMessage({ id: "app.actions.detail.endTime" })}
                id="action-end-time"
                type="datetime-local"
                variant="outlined"
                value={toDateTimeLocalValue(form.watch("endTime").getTime())}
                onChange={(e) => form.setValue("endTime", fromDateTimeLocalValue(e.target.value))}
              />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="space-y-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-strong">
              {formatMessage({ id: "app.actions.edit.instructionsConfig" })}
            </h3>
            {!isLoadingInstructions && (
              <AdminButton
                type="button"
                variant="text"
                size="sm"
                onClick={() => setIsEditingInstructions(!isEditingInstructions)}
              >
                {isEditingInstructions
                  ? formatMessage({ id: "app.actions.edit.cancelEditing" })
                  : formatMessage({ id: "app.actions.edit.editInstructions" })}
              </AdminButton>
            )}
          </div>

          {isLoadingInstructions ? (
            <p className="text-sm text-text-sub">
              {formatMessage({ id: "app.actions.edit.loadingInstructions" })}
            </p>
          ) : isEditingInstructions ? (
            <InstructionsBuilder value={instructionConfig} onChange={setInstructionConfig} />
          ) : (
            <p className="text-sm text-text-sub">
              {formatMessage({ id: "app.actions.edit.instructionsHint" })}
            </p>
          )}

          {!isLoadingInstructions ? (
            <ActionTranslationEditor
              sourceTitle={form.watch("title")}
              sourceConfig={instructionConfig}
              value={translations}
              onChange={(nextTranslations) => {
                setTranslations(nextTranslations);
                setTranslationsDirty(true);
              }}
            />
          ) : null}
        </AdminCard>

        <AdminCard className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <AdminButton type="submit" variant="filled" disabled={isLoading} loading={isLoading}>
            {formatMessage({ id: "app.actions.edit.saveChanges" })}
          </AdminButton>
          <AdminButton type="button" variant="outlined" onClick={cancel}>
            {formatMessage({ id: "app.common.cancel" })}
          </AdminButton>
        </AdminCard>
      </form>
    </CanvasRouteContent>
  );

  if (layout === "sheet") {
    return formContent;
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        maxWidthClassName="max-w-5xl"
        title={formatMessage({ id: "app.actions.edit.title" }, { name: action.title })}
        description={formatMessage({
          id: "cockpit.actions.editDescription",
          defaultMessage: "Update lifecycle details and the submission contract for this action.",
        })}
        variant="canvas"
        backLink={{
          to: actionDetailHref,
          label: formatMessage({
            id: "app.actions.backToAction",
            defaultMessage: "Back to action",
          }),
        }}
        sticky
      />
      {formContent}
    </CanvasRouteFrame>
  );
}
