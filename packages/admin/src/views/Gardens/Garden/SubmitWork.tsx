import {
  cn,
  DEFAULT_CHAIN_ID,
  expandDomainMask,
  type Action,
  type Address,
  type Domain,
  type WorkInput,
  findActionByUID,
  getActionTitle,
  parseActionUID,
  parseAndFormatError,
  submitWorkDirectly,
  toastService,
  useActions,
  useAuth,
  useGardenPermissions,
  useGardens,
  useBeforeUnloadWhilePending,
  useWorkForm,
  queryKeys,
  logger,
} from "@green-goods/shared";
import { RiUploadCloudLine } from "@remixicon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";
import { FileUploadField } from "@/components/FileUploadField";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";

// ─────────────────────────────────────────────────────────────
// Input class — matches admin form pattern (CreateGardenSteps)
// ─────────────────────────────────────────────────────────────

const INPUT_CLASS =
  "w-full rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-sm text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24";

const INPUT_ERROR_CLASS = "border-error-base focus:border-error-base focus:ring-error-lighter";

// ─────────────────────────────────────────────────────────────
// Dynamic field renderer
// ─────────────────────────────────────────────────────────────

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
              <FormField
                key={input.key}
                label={input.title}
                htmlFor={input.key}
                required={input.required}
                error={error}
              >
                <input
                  id={input.key}
                  type="number"
                  step="any"
                  min={0}
                  placeholder={input.placeholder}
                  className={cn(INPUT_CLASS, error && INPUT_ERROR_CLASS)}
                  {...register(input.key, { valueAsNumber: true })}
                />
              </FormField>
            );

          case "text":
            return (
              <FormField
                key={input.key}
                label={input.title}
                htmlFor={input.key}
                required={input.required}
                error={error}
              >
                <input
                  id={input.key}
                  type="text"
                  placeholder={input.placeholder}
                  className={cn(INPUT_CLASS, error && INPUT_ERROR_CLASS)}
                  {...register(input.key)}
                />
              </FormField>
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
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
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
                      {(input.options ?? []).map((opt) => {
                        const selected = Array.isArray(field.value) && field.value.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const current = Array.isArray(field.value) ? field.value : [];
                              field.onChange(
                                selected
                                  ? current.filter((v: string) => v !== opt)
                                  : [...current, opt]
                              );
                            }}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium transition",
                              selected
                                ? "border-primary-base bg-primary-alpha-16 text-primary-darker"
                                : "border-stroke-soft bg-bg-white text-text-sub hover:border-primary-base"
                            )}
                          >
                            {opt}
                          </button>
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

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function SubmitWork() {
  const { id: gardenId } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Data hooks
  const { data: gardens = [] } = useGardens();
  const { data: actions = [] } = useActions();
  const { isAuthenticated } = useAuth();
  const { canManageGarden } = useGardenPermissions();

  // Find garden
  const garden = useMemo(() => gardens.find((g) => g.id === gardenId), [gardens, gardenId]);

  // Filter actions by garden's domain mask
  const gardenDomains = useMemo<Set<Domain>>(
    () => new Set(garden?.domainMask ? expandDomainMask(garden.domainMask) : []),
    [garden?.domainMask]
  );

  const availableActions = useMemo(
    () => actions.filter((a) => gardenDomains.has(a.domain)),
    [actions, gardenDomains]
  );

  // Selected action state
  const [selectedActionId, setSelectedActionId] = useState<string>("");
  const selectedAction = useMemo<Action | null>(() => {
    if (!selectedActionId) return null;
    const uid = parseActionUID(selectedActionId);
    return findActionByUID(actions, uid);
  }, [selectedActionId, actions]);

  // Form — rebuilds schema when action changes
  const form = useWorkForm(selectedAction?.inputs);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
  } = form;

  // Images state (simple — no IndexedDB persistence needed for admin)
  const [images, setImages] = useState<File[]>([]);

  // Progress state for submission feedback
  const [progressMessage, setProgressMessage] = useState<string>("");

  // Permission check
  const canSubmit = garden ? canManageGarden(garden) : false;

  // Navigate back to garden detail work tab
  const goBack = useCallback(() => {
    navigate(`/gardens/${gardenId}?tab=work`);
  }, [navigate, gardenId]);

  // Submission mutation
  const chainId = DEFAULT_CHAIN_ID;
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

      // Build the WorkDraft from form data
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
        chainId,
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

      // Invalidate work queries so the new submission appears
      if (garden) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.online(garden.id as Address, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.merged(garden.id as Address, chainId),
        });
      }

      goBack();
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

  // Warn user before closing tab during pending submission
  useBeforeUnloadWhilePending(mutation.isPending);

  const onSubmit = handleSubmit((data) => {
    if (!selectedAction) return;
    mutation.mutate(data as Record<string, unknown>);
  });

  // Reset form when action changes
  const handleActionChange = (actionId: string) => {
    setSelectedActionId(actionId);
    resetForm();
    setImages([]);
  };

  // ── Render ───────────────────────────────────────────────
  const baseHeaderProps = {
    backLink: {
      to: `/gardens/${gardenId}?tab=work`,
      label: formatMessage({ id: "app.admin.work.submit.backToGarden" }),
    },
    sticky: true,
  } as const;

  if (!garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.admin.work.submit.title" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6">
          <Alert variant="error">{formatMessage({ id: "app.garden.admin.notFound" })}</Alert>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.admin.work.submit.title" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6">
          <Alert variant="warning">
            {formatMessage({ id: "app.admin.work.submit.connectWallet" })}
          </Alert>
        </div>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.admin.work.submit.title" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6">
          <Alert variant="warning">
            {formatMessage({ id: "app.admin.work.submit.noPermission" })}
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.admin.work.submit.title" })}
        description={formatMessage({ id: "app.admin.work.submit.description" })}
        {...baseHeaderProps}
      />

      <div className="mx-auto mt-6 max-w-2xl px-4 sm:px-6">
        <form onSubmit={onSubmit}>
          <Card>
            <Card.Body className="space-y-5">
              {/* Action selector */}
              <FormField
                label={formatMessage({ id: "app.admin.work.submit.selectAction" })}
                htmlFor="action-select"
                required
              >
                {availableActions.length === 0 ? (
                  <Alert variant="info">
                    {formatMessage({ id: "app.admin.work.submit.noActionsForDomain" })}
                  </Alert>
                ) : (
                  <select
                    id="action-select"
                    value={selectedActionId}
                    onChange={(e) => handleActionChange(e.target.value)}
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

              {/* Dynamic fields from selected action */}
              {selectedAction && selectedAction.inputs.length > 0 && (
                <DynamicWorkFields
                  inputs={selectedAction.inputs}
                  control={control}
                  register={register}
                  errors={errors as Record<string, { message?: string } | undefined>}
                />
              )}

              {/* Time spent */}
              {selectedAction && (
                <>
                  <FormField
                    label={formatMessage({ id: "app.admin.work.submit.timeSpent" })}
                    htmlFor="timeSpentMinutes"
                    hint={formatMessage({ id: "app.admin.work.submit.timeSpentHint" })}
                    error={errors.timeSpentMinutes?.message}
                  >
                    <input
                      id="timeSpentMinutes"
                      type="number"
                      step="0.25"
                      min={0}
                      placeholder={formatMessage({
                        id: "app.admin.work.submit.timeSpentPlaceholder",
                      })}
                      className={cn(INPUT_CLASS, errors.timeSpentMinutes && INPUT_ERROR_CLASS)}
                      {...register("timeSpentMinutes")}
                    />
                  </FormField>

                  {/* Feedback */}
                  <FormField
                    label={formatMessage({ id: "app.admin.work.submit.feedback" })}
                    htmlFor="feedback"
                    error={errors.feedback?.message}
                  >
                    <textarea
                      id="feedback"
                      rows={3}
                      placeholder={formatMessage({
                        id: "app.admin.work.submit.feedbackPlaceholder",
                      })}
                      className={cn(INPUT_CLASS, "resize-y", errors.feedback && INPUT_ERROR_CLASS)}
                      {...register("feedback")}
                    />
                  </FormField>

                  {/* Image upload */}
                  <FileUploadField
                    label={formatMessage({ id: "app.admin.work.submit.media" })}
                    helpText={formatMessage({ id: "app.admin.work.submit.mediaHint" })}
                    accept="image/*"
                    multiple
                    compress
                    showPreview
                    currentFiles={images}
                    onFilesChange={(newFiles) => setImages((prev) => [...prev, ...newFiles])}
                    onRemoveFile={(index) =>
                      setImages((prev) => prev.filter((_, i) => i !== index))
                    }
                    disabled={mutation.isPending}
                  />
                </>
              )}
            </Card.Body>

            {/* Submit footer */}
            {selectedAction && (
              <Card.Footer className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {progressMessage && (
                    <p className="truncate text-sm text-text-sub">{progressMessage}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={goBack}
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
            )}
          </Card>
        </form>
      </div>
    </div>
  );
}
