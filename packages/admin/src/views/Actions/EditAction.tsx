import {
  type ActionInstructionConfig,
  adminRoutes,
  DEFAULT_CHAIN_ID,
  defaultTemplate,
  Surface,
  fromDateTimeLocalValue,
  getActionEditDraftPath,
  getFileByHash,
  getActionsListSearch,
  instructionTemplates,
  logger,
  restoreEditActionDraft,
  serializeEditActionDraft,
  toastService,
  toDateTimeLocalValue,
  toSafeDate,
  uploadFileToIPFS,
  useActionOperations,
  useActions,
  useAsyncEffect,
  useSheetOrchestratorStore,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { InstructionsBuilder } from "@/components/Action/InstructionsBuilder";
import { AdminButton } from "@/components/AdminButton";
import { AdminTextField } from "@/components/AdminTextField";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";

const editActionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

type EditActionFormData = z.infer<typeof editActionSchema>;

const INSTRUCTION_LOAD_TIMEOUT_MS = 8_000;

function cloneInstructionConfig(config: ActionInstructionConfig): ActionInstructionConfig {
  return {
    description: config.description,
    uiConfig: {
      media: {
        ...config.uiConfig.media,
        needed: [...config.uiConfig.media.needed],
        optional: [...config.uiConfig.media.optional],
      },
      details: {
        ...config.uiConfig.details,
        inputs: [...config.uiConfig.details.inputs],
      },
      review: { ...config.uiConfig.review },
    },
  };
}

async function parseInstructionConfig(
  data: Blob | string
): Promise<ActionInstructionConfig | null> {
  const isInstructionConfig = (value: unknown): value is ActionInstructionConfig => {
    if (!value || typeof value !== "object") return false;
    const config = value as Partial<ActionInstructionConfig>;
    return !!(
      config.uiConfig &&
      config.uiConfig.media &&
      config.uiConfig.details &&
      config.uiConfig.review
    );
  };

  if (typeof data === "string") {
    const parsed = JSON.parse(data) as unknown;
    return isInstructionConfig(parsed) ? parsed : null;
  }
  if (data instanceof Blob) {
    const text = await data.text();
    const parsed = JSON.parse(text) as unknown;
    return isInstructionConfig(parsed) ? parsed : null;
  }
  return null;
}

interface EditActionProps {
  layout?: "page" | "sheet";
}

export default function EditAction({ layout = "page" }: EditActionProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatMessage } = useIntl();
  const { data: actions = [], isLoading: actionsLoading } = useActions(DEFAULT_CHAIN_ID);
  const action = actions.find((a) => a.id === id);
  const {
    updateActionTitle,
    updateActionStartTime,
    updateActionEndTime,
    updateActionInstructions,
    isLoading,
  } = useActionOperations(DEFAULT_CHAIN_ID);

  const form = useForm<EditActionFormData>({
    resolver: zodResolver(editActionSchema),
    defaultValues: {
      title: "",
      startTime: new Date(),
      endTime: new Date(),
    },
  });

  const [instructionConfig, setInstructionConfig] =
    useState<ActionInstructionConfig>(defaultTemplate);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [isLoadingInstructions, setIsLoadingInstructions] = useState(false);
  const setDraftFormState = useSheetOrchestratorStore((state) => state.setFormState);
  const clearDraftFormState = useSheetOrchestratorStore((state) => state.clearViewState);
  const restoredDraftPathRef = useRef<string | null>(null);
  const listSearch = useMemo(
    () => getActionsListSearch(new URLSearchParams(location.search)),
    [location.search]
  );
  const actionsListHref = useMemo(() => adminRoutes.actions(listSearch), [listSearch]);
  const actionDetailHref = id ? adminRoutes.actionDetail(id, listSearch) : actionsListHref;
  const draftPath = useMemo(() => getActionEditDraftPath(id), [id]);

  // Sync form state when action data loads or changes
  useAsyncEffect(
    async ({ isMounted }) => {
      if (!action) return;
      const fallbackConfig = cloneInstructionConfig(
        instructionTemplates[action.slug] ?? defaultTemplate
      );
      const restoreDraft = (resolvedConfig: ActionInstructionConfig) => {
        if (!draftPath || restoredDraftPathRef.current === draftPath) return false;
        restoredDraftPathRef.current = draftPath;
        const savedDraft =
          useSheetOrchestratorStore.getState().restoreViewState(draftPath)?.formState ?? null;
        const restoredDraft = restoreEditActionDraft(savedDraft);
        if (!restoredDraft) return false;

        form.reset({
          title: restoredDraft.title || action.title || "",
          startTime: restoredDraft.startTime,
          endTime: restoredDraft.endTime,
        });
        setInstructionConfig(restoredDraft.instructionConfig ?? resolvedConfig);
        setIsEditingInstructions(restoredDraft.isEditingInstructions);
        return true;
      };

      form.reset({
        title: action.title || "",
        startTime: toSafeDate(action.startTime) ?? new Date(),
        endTime: toSafeDate(action.endTime) ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      if (isMounted()) {
        setInstructionConfig(fallbackConfig);
      }
      const didRestoreDraft = isMounted() ? restoreDraft(fallbackConfig) : false;

      if (!action.instructions) {
        return;
      }

      setIsLoadingInstructions(true);
      let resolvedConfig = fallbackConfig;
      try {
        const file = await getFileByHash(action.instructions, {
          timeoutMs: INSTRUCTION_LOAD_TIMEOUT_MS,
        });
        const config = await parseInstructionConfig(file.data);
        if (isMounted()) {
          if (config && !didRestoreDraft) {
            resolvedConfig = config;
            setInstructionConfig(config);
          } else if (!didRestoreDraft) {
            setInstructionConfig(fallbackConfig);
          }
        }
      } catch (error) {
        if (isMounted()) {
          logger.error("Failed to load instructions", { error });
          toastService.error({
            title: formatMessage({ id: "app.actions.edit.loadInstructionsFailed" }),
            description: formatMessage({ id: "app.actions.edit.usingDefault" }),
          });
        }
      } finally {
        if (isMounted()) {
          setIsLoadingInstructions(false);
          if (!didRestoreDraft) {
            restoreDraft(resolvedConfig);
          }
        }
      }
    },
    [action?.id, action?.instructions, draftPath]
  );

  useEffect(() => {
    if (!draftPath || !action || restoredDraftPathRef.current !== draftPath) return;

    const subscription = form.watch((value) => {
      setDraftFormState(
        draftPath,
        serializeEditActionDraft(value, instructionConfig, isEditingInstructions)
      );
    });

    return () => subscription.unsubscribe();
  }, [action, draftPath, form, instructionConfig, isEditingInstructions, setDraftFormState]);

  useEffect(() => {
    if (!draftPath || !action || restoredDraftPathRef.current !== draftPath) return;
    setDraftFormState(
      draftPath,
      serializeEditActionDraft(form.getValues(), instructionConfig, isEditingInstructions)
    );
  }, [action, draftPath, form, instructionConfig, isEditingInstructions, setDraftFormState]);

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
          <Surface elevation="raised" padding="default" role="status" aria-live="polite">
            <p className="text-text-sub">{formatMessage({ id: "app.actions.loading" })}</p>
          </Surface>
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
          <Surface elevation="raised" padding="default" className="text-center">
            <p className="text-text-sub">{formatMessage({ id: "app.actions.notFound" })}</p>
          </Surface>
        </CanvasRouteContent>
      </CanvasRouteFrame>
    );
  }

  const onSubmit = async (data: EditActionFormData) => {
    try {
      const actionUID = id!.split("-")[1];

      if (data.title !== action.title) {
        await updateActionTitle(actionUID, data.title);
      }

      if (data.startTime.getTime() !== action.startTime) {
        await updateActionStartTime(actionUID, Math.floor(data.startTime.getTime() / 1000));
      }

      if (data.endTime.getTime() !== action.endTime) {
        await updateActionEndTime(actionUID, Math.floor(data.endTime.getTime() / 1000));
      }

      if (isEditingInstructions) {
        toastService.loading({
          title: formatMessage({ id: "app.actions.edit.uploadingInstructions" }),
        });
        const instructionsBlob = new Blob([JSON.stringify(instructionConfig, null, 2)], {
          type: "application/json",
        });
        const instructionsFile = new File([instructionsBlob], "instructions.json", {
          type: "application/json",
        });
        const instructionsUpload = await uploadFileToIPFS(instructionsFile);
        const instructionsCID = instructionsUpload.cid;
        toastService.dismiss();

        await updateActionInstructions(actionUID, instructionsCID);
      }

      toastService.success({ title: formatMessage({ id: "app.actions.edit.success" }) });
      if (draftPath) {
        clearDraftFormState(draftPath);
      }
      navigate(actionDetailHref);
    } catch (error) {
      logger.error("Failed to update action", { error });
      toastService.error({ title: formatMessage({ id: "app.actions.edit.failed" }) });
    }
  };

  const formContent = (
    <CanvasRouteContent
      maxWidthClassName={layout === "sheet" ? "max-w-none" : "max-w-5xl"}
      className={layout === "sheet" ? "p-4" : "mt-4"}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Surface elevation="raised" padding="default" className="space-y-4">
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
        </Surface>

        <Surface elevation="raised" padding="default" className="space-y-4">
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
        </Surface>

        <Surface
          elevation="raised"
          padding="default"
          className="flex flex-col gap-3 sm:flex-row sm:justify-end"
        >
          <AdminButton type="submit" variant="filled" disabled={isLoading} loading={isLoading}>
            {isLoading
              ? formatMessage({ id: "app.actions.edit.saving" })
              : formatMessage({ id: "app.actions.edit.saveChanges" })}
          </AdminButton>
          <AdminButton type="button" variant="outlined" onClick={() => navigate(actionDetailHref)}>
            {formatMessage({ id: "app.common.cancel" })}
          </AdminButton>
        </Surface>
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
