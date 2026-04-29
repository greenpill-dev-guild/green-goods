import {
  type Action,
  type Address,
  Alert,
  adminRoutes,
  Button,
  Card,
  cn,
  DEFAULT_CHAIN_ID,
  type Domain,
  expandDomainMask,
  FileUploadField,
  FormField,
  findActionByUID,
  getActionTitle,
  logger,
  parseActionUID,
  parseAndFormatError,
  queryKeys,
  submitWorkDirectly,
  toastService,
  useAdminGardenWorkspaceSelection,
  useActions,
  useAuthState,
  useBeforeUnloadWhilePending,
  useGardenPermissions,
  useGardens,
  useWorkForm,
  type WorkInput,
} from "@green-goods/shared";
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

const INPUT_CLASS =
  "w-full rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-sm text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24";

const INPUT_ERROR_CLASS = "border-error-base focus:border-error-base focus:ring-error-lighter";

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
                <textarea
                  id={input.key}
                  rows={3}
                  placeholder={input.placeholder}
                  className={cn(INPUT_CLASS, "resize-y", error && INPUT_ERROR_CLASS)}
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
                <select
                  id={input.key}
                  className={cn(INPUT_CLASS, error && INPUT_ERROR_CLASS)}
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
                </select>
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
      const { title, message } = parseAndFormatError(error);
      logger.error("Admin work submission failed", { error });

      toastService.error({
        title: title || formatMessage({ id: "app.admin.work.submit.error" }),
        message,
        context: "admin work submission",
        error,
      });
    },
    onSettled: () => {
      setProgressMessage("");
    },
  });

  useBeforeUnloadWhilePending(mutation.isPending);

  const onSubmit = handleSubmit((data) => {
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

  const formCard = (
    <form onSubmit={onSubmit}>
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
              <select
                id="action-select"
                value={selectedActionId}
                onChange={(event) => handleActionChange(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">
                  {formatMessage({ id: "app.admin.work.submit.selectActionPlaceholder" })}
                </option>
                {availableActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.title}
                  </option>
                ))}
              </select>
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
                <textarea
                  id="feedback"
                  rows={3}
                  placeholder={formatMessage({ id: "app.admin.work.submit.feedbackPlaceholder" })}
                  className={cn(INPUT_CLASS, "resize-y", errors.feedback && INPUT_ERROR_CLASS)}
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

        {selectedAction ? (
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

  return layout === "page" ? (
    <CanvasRouteContent maxWidthClassName="max-w-2xl" className="mt-6">
      {formCard}
    </CanvasRouteContent>
  ) : (
    <div className="p-1">{formCard}</div>
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
