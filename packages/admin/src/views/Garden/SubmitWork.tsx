import {
  type Action,
  type Address,
  Alert,
  adminRoutes,
  Button,
  Card,
  DEFAULT_CHAIN_ID,
  type Domain,
  expandDomainMask,
  FileUploadField,
  FormField,
  findActionByUID,
  getActionTitle,
  logger,
  NativeSelect,
  parseActionUID,
  parseAndFormatError,
  queryKeys,
  SheetBody,
  SheetFooter,
  submitWorkDirectly,
  Textarea,
  toastService,
  validationToasts,
  useAdminGardenWorkspaceSelection,
  useActions,
  useAuthState,
  useBeforeUnloadWhilePending,
  useGardenPermissions,
  useGardens,
  useWorkForm,
  type WorkInput,
} from "@green-goods/shared";
import { validateWorkSubmissionContext } from "@green-goods/shared/modules";
import { RiUploadCloudLine } from "@remixicon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminTextField } from "@/components/AdminTextField";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";

function parseHubContext(search: string) {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const sort = params.get("sort");

  return {
    gardenAddress: params.get("gardenAddress") ?? undefined,
    view:
      view === "work" || view === "assess" || view === "certify" || view === "history"
        ? view
        : undefined,
    sort: sort === "newest" || sort === "oldest" ? sort : undefined,
  } as const;
}

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

        switch (input.type) {
          case "number":
            return (
              <AdminTextField
                key={input.key}
                label={input.title}
                id={input.key}
                type="number"
                variant="outlined"
                required={input.required}
                error={error}
                placeholder={input.placeholder}
                inputProps={{ step: "any", min: 0 }}
                {...register(input.key, { valueAsNumber: true })}
              />
            );

          case "text":
            return (
              <AdminTextField
                key={input.key}
                label={input.title}
                id={input.key}
                type="text"
                variant="outlined"
                required={input.required}
                error={error}
                placeholder={input.placeholder}
                {...register(input.key)}
              />
            );

          case "textarea":
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

          case "select":
          case "band": {
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

          case "multi-select":
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
                        const selected = Array.isArray(field.value) && field.value.includes(option);
                        return (
                          <AdminButton
                            key={option}
                            type="button"
                            variant={selected ? "tonal" : "outlined"}
                            size="sm"
                            onClick={() => {
                              const current = Array.isArray(field.value) ? field.value : [];
                              field.onChange(
                                selected
                                  ? current.filter((value: string) => value !== option)
                                  : [...current, option]
                              );
                            }}
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

          default:
            return null;
        }
      })}
    </>
  );
}

function getMinRequiredImages(action: Action | null) {
  if (!action?.mediaInfo?.required) return 0;
  return action.mediaInfo.minImageCount ?? 1;
}

function getOriginalError(error: unknown) {
  return error instanceof Error && error.cause instanceof Error ? error.cause : error;
}

type SubmitWorkLayout = "page" | "sheet";

export interface SubmitWorkPanelProps {
  layout?: SubmitWorkLayout;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SubmitWorkPanel({ layout = "page", onSuccess, onCancel }: SubmitWorkPanelProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const gardenId = selectedGarden?.id ?? null;

  const { data: gardens = [] } = useGardens();
  const { data: actions = [] } = useActions();
  const { isAuthenticated } = useAuthState();
  const { canManageGarden } = useGardenPermissions();

  const garden = useMemo(
    () => gardens.find((candidate) => candidate.id === gardenId),
    [gardens, gardenId]
  );
  const gardenDomains = useMemo<Set<Domain>>(
    () => new Set(garden?.domainMask ? expandDomainMask(garden.domainMask) : []),
    [garden?.domainMask]
  );
  const availableActions = useMemo(
    () => actions.filter((action) => gardenDomains.has(action.domain)),
    [actions, gardenDomains]
  );

  const [selectedActionId, setSelectedActionId] = useState("");
  const selectedAction = useMemo<Action | null>(() => {
    if (!selectedActionId) return null;
    const uid = parseActionUID(selectedActionId);
    return findActionByUID(actions, uid);
  }, [selectedActionId, actions]);

  const form = useWorkForm(selectedAction?.inputs);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
  } = form;

  const [images, setImages] = useState<File[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const canSubmit = garden ? canManageGarden(garden) : false;

  const mutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      if (!garden || !selectedAction) {
        throw new Error("Garden and action must be selected");
      }

      const actionUID = parseActionUID(selectedAction.id);
      if (actionUID === null) {
        throw new Error("Invalid action ID");
      }

      const actionTitle = getActionTitle(actions, actionUID);
      const { feedback, timeSpentMinutes, ...details } = formData;
      const draft = {
        actionUID,
        title: actionTitle,
        timeSpentMinutes: typeof timeSpentMinutes === "number" ? timeSpentMinutes : 0,
        feedback: typeof feedback === "string" ? feedback : "",
        media: images,
        details: details as Record<string, unknown>,
      };

      setProgressMessage(formatMessage({ id: "app.admin.work.submit.progress.validating" }));

      return submitWorkDirectly(
        draft,
        garden.id as Address,
        actionUID,
        actionTitle,
        DEFAULT_CHAIN_ID,
        images,
        {
          onProgress: (stage, message) => {
            const i18nKey = `app.admin.work.submit.progress.${stage}`;
            setProgressMessage(formatMessage({ id: i18nKey, defaultMessage: message }));
          },
        }
      );
    },
    onSuccess: () => {
      toastService.success({
        title: formatMessage({ id: "app.admin.work.submit.success" }),
      });

      if (garden) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.online(garden.id as Address, DEFAULT_CHAIN_ID),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.merged(garden.id as Address, DEFAULT_CHAIN_ID),
        });
      }

      onSuccess?.();
    },
    onError: (error: unknown) => {
      setProgressMessage("");
      const originalError = getOriginalError(error);
      const { title, message } = parseAndFormatError(originalError);
      logger.error("Admin work submission failed", { error, originalError });

      toastService.error({
        title: title || formatMessage({ id: "app.admin.work.submit.error" }),
        message,
        context: "admin work submission",
        error: originalError,
      });
    },
    onSettled: () => {
      setProgressMessage("");
    },
  });

  useBeforeUnloadWhilePending(mutation.isPending);

  const onSubmit = handleSubmit((data) => {
    const actionUID = selectedAction ? parseActionUID(selectedAction.id) : null;
    const validationErrors = validateWorkSubmissionContext(
      garden.id as Address,
      actionUID,
      images,
      {
        minRequired: getMinRequiredImages(selectedAction),
      }
    );

    if (validationErrors.length > 0) {
      validationToasts.formError(validationErrors[0]);
      return;
    }

    if (!selectedAction) return;
    mutation.mutate(data as Record<string, unknown>);
  });

  const handleActionChange = (actionId: string) => {
    setSelectedActionId(actionId);
    resetForm();
    setImages([]);
  };

  const renderState = (variant: "error" | "warning", messageId: string) => {
    const state = <Alert variant={variant}>{formatMessage({ id: messageId })}</Alert>;

    return layout === "page" ? (
      <CanvasRouteContent maxWidthClassName="max-w-2xl" className="mt-6">
        {state}
      </CanvasRouteContent>
    ) : (
      state
    );
  };

  if (!garden) {
    return renderState("error", "app.garden.admin.notFound");
  }

  if (!isAuthenticated) {
    return renderState("warning", "app.admin.work.submit.connectWallet");
  }

  if (!canSubmit) {
    return renderState("warning", "app.admin.work.submit.noPermission");
  }

  // Stable form id so the sheet-mode SheetFooter submit button can target the
  // form via the `form="..."` attribute (handoff sheet anatomy: pinned footer
  // sits OUTSIDE the form element and triggers submit by id).
  const formId = "submit-work-form";

  const formCard = (
    <form id={formId} onSubmit={onSubmit}>
      <Card>
        <Card.Body className="space-y-5">
          <FormField
            label={formatMessage({ id: "app.admin.work.submit.selectAction" })}
            htmlFor="action-select"
            required
          >
            {availableActions.length === 0 ? (
              <Alert
                variant="info"
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate(adminRoutes.gardenSettings({ gardenAddress: garden.id }))
                    }
                  >
                    {formatMessage({ id: "app.admin.work.submit.noActionsForDomain.cta" })}
                  </Button>
                }
              >
                {formatMessage({ id: "app.admin.work.submit.noActionsForDomain" })}
              </Alert>
            ) : (
              <NativeSelect
                surface="admin"
                id="action-select"
                value={selectedActionId}
                onChange={(event) => handleActionChange(event.target.value)}
              >
                <option value="">
                  {formatMessage({ id: "app.admin.work.submit.selectActionPlaceholder" })}
                </option>
                {availableActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.title}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          {selectedAction && selectedAction.inputs.length > 0 ? (
            <DynamicWorkFields
              inputs={selectedAction.inputs}
              control={control}
              register={register}
              errors={errors as Record<string, { message?: string } | undefined>}
            />
          ) : null}

          {selectedAction ? (
            <>
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

              <FileUploadField
                label={formatMessage({ id: "app.admin.work.submit.media" })}
                helpText={formatMessage({ id: "app.admin.work.submit.mediaHint" })}
                accept="image/*"
                multiple
                compress
                showPreview
                currentFiles={images}
                onFilesChange={(newFiles) => setImages((prev) => [...prev, ...newFiles])}
                onRemoveFile={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
                disabled={mutation.isPending}
              />
            </>
          ) : null}
        </Card.Body>

        {selectedAction && layout === "page" ? (
          <Card.Footer className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {progressMessage ? (
                <p className="truncate text-sm text-text-sub">{progressMessage}</p>
              ) : null}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onCancel?.()}
                disabled={mutation.isPending}
              >
                {formatMessage({ id: "app.wizard.cancel", defaultMessage: "Cancel" })}
              </Button>
              <Button
                type="submit"
                loading={mutation.isPending}
                disabled={mutation.isPending || availableActions.length === 0}
              >
                <RiUploadCloudLine className="h-4 w-4" />
                {mutation.isPending
                  ? formatMessage({ id: "app.admin.work.submit.submitting" })
                  : formatMessage({ id: "app.admin.work.submit.submit" })}
              </Button>
            </div>
          </Card.Footer>
        ) : null}
      </Card>
    </form>
  );

  if (layout === "page") {
    return (
      <CanvasRouteContent maxWidthClassName="max-w-2xl" className="mt-6">
        {formCard}
      </CanvasRouteContent>
    );
  }

  // Sheet layout: SheetBody (scrolls) + pinned SheetFooter. The form lives
  // inside SheetBody so its inputs scroll naturally; the submit button uses
  // `form={formId}` to trigger submit even though it sits outside the form.
  return (
    <>
      <SheetBody padded={false} className="p-1">
        {formCard}
      </SheetBody>
      {selectedAction ? (
        <SheetFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onCancel?.()}
            disabled={mutation.isPending}
          >
            {formatMessage({ id: "app.wizard.cancel", defaultMessage: "Cancel" })}
          </Button>
          <div className="min-w-0 flex-1">
            {progressMessage ? (
              <p className="truncate text-sm text-text-sub">{progressMessage}</p>
            ) : null}
          </div>
          <Button
            type="submit"
            form={formId}
            loading={mutation.isPending}
            disabled={mutation.isPending || availableActions.length === 0}
          >
            <RiUploadCloudLine className="h-4 w-4" />
            {mutation.isPending
              ? formatMessage({ id: "app.admin.work.submit.submitting" })
              : formatMessage({ id: "app.admin.work.submit.submit" })}
          </Button>
        </SheetFooter>
      ) : null}
    </>
  );
}

export default function SubmitWork() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  const hubContext = parseHubContext(location.search);

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        maxWidthClassName="max-w-2xl"
        title={formatMessage({ id: "app.admin.work.submit.title" })}
        description={formatMessage({ id: "app.admin.work.submit.description" })}
        backLink={{
          to: adminRoutes.hub(hubContext),
          label: formatMessage({ id: "app.admin.work.submit.backToGarden" }),
        }}
        sticky
      />
      <SubmitWorkPanel
        layout="page"
        onSuccess={() => navigate(adminRoutes.hub(hubContext))}
        onCancel={() => navigate(adminRoutes.hub(hubContext))}
      />
    </CanvasRouteFrame>
  );
}
