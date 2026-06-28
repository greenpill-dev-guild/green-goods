import {
  type Action,
  type Address,
  Alert,
  adminRoutes,
  type Domain,
  expandDomainMask,
  FileUploadField,
  FormField,
  findActionByUID,
  getActionTitle,
  imageCompressor,
  isOfflineTxHash,
  logger,
  normalizeWorkMediaFiles,
  NativeSelect,
  parseActionUID,
  Textarea,
  toastService,
  TxInlineFeedback,
  validationToasts,
  useAdminGardenWorkspaceSelection,
  useActions,
  type AuthStateValue,
  useAuthState,
  useBeforeUnloadWhilePending,
  useGardenPermissions,
  useGardens,
  useUser,
  useWorkForm,
  useWorkMutation,
  type WorkInput,
} from "@green-goods/shared";
import { validateWorkSubmissionContext } from "@green-goods/shared/modules";
import { RiSeedlingLine, RiUploadCloudLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { AdminTextField } from "@/components/AdminTextField";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FormFlow, type FormFlowSection } from "@/components/Layout/FormFlow";
import { ActionChooserGrid } from "./components/ActionChooserGrid";

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

// "page" = standalone panel with no dialog chrome (tests, inline embedding);
// "dialog" = hosted in the centered 2xl AdminDialog at /hub/work/submit (a centered
// card on desktop, a bottom-sheet on mobile). Both render the same workflow body
// through ActionFlowShell — only the outer shell + close-button reservation differ.
type SubmitWorkLayout = "page" | "dialog";
type MediaFeedback = { variant: "warning" | "error"; message: string };
type SubmitWorkAuthSnapshot = Pick<AuthStateValue, "authMode" | "isAuthenticated"> & {
  primaryAddress: Address | null | undefined;
};

export interface SubmitWorkPanelProps {
  layout?: SubmitWorkLayout;
  onSuccess?: () => void;
  onCancel?: () => void;
  auth?: SubmitWorkAuthSnapshot;
}

const ADMIN_WORK_MEDIA_COMPRESSION_THRESHOLD_KB = 1024;
const ADMIN_WORK_MEDIA_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 2048,
  initialQuality: 0.8,
  useWebWorker: true,
} as const;

async function compressAdminWorkMediaFiles(
  files: File[],
  onProgress: (progress: number) => void
): Promise<File[]> {
  const filesToCompress = files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) =>
      imageCompressor.shouldCompress(file, ADMIN_WORK_MEDIA_COMPRESSION_THRESHOLD_KB)
    );

  if (filesToCompress.length === 0) return files;

  const compressed = await imageCompressor.compressImages(
    filesToCompress.map(({ file }) => file),
    ADMIN_WORK_MEDIA_COMPRESSION_OPTIONS,
    (progress) => onProgress(progress)
  );

  const preparedFiles = files.slice();
  compressed.forEach((result, compressedIndex) => {
    const originalIndex = filesToCompress[compressedIndex]?.index;
    if (originalIndex !== undefined) {
      preparedFiles[originalIndex] = result.file;
    }
  });

  return preparedFiles;
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function SubmitWorkPanel({ auth, ...props }: SubmitWorkPanelProps) {
  if (auth) {
    return <SubmitWorkPanelContent {...props} auth={auth} />;
  }

  return <SubmitWorkPanelWithAuth {...props} />;
}

function SubmitWorkPanelWithAuth(props: Omit<SubmitWorkPanelProps, "auth">) {
  const { isAuthenticated, authMode } = useAuthState();
  const { primaryAddress } = useUser();

  return <SubmitWorkPanelContent {...props} auth={{ authMode, isAuthenticated, primaryAddress }} />;
}

function SubmitWorkPanelContent({
  layout = "page",
  onSuccess,
  onCancel,
  auth,
}: Omit<SubmitWorkPanelProps, "auth"> & { auth: SubmitWorkAuthSnapshot }) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const gardenId = selectedGarden?.id ?? null;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const { data: actions = [], isLoading: actionsLoading } = useActions();
  const { authMode, isAuthenticated, primaryAddress } = auth;
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
  const selectedActionIdRef = useRef(selectedActionId);
  selectedActionIdRef.current = selectedActionId;
  const selectedAction = useMemo<Action | null>(() => {
    if (!selectedActionId) return null;
    const uid = parseActionUID(selectedActionId);
    return findActionByUID(actions, uid);
  }, [selectedActionId, actions]);
  const selectedActionUID = useMemo(
    () => (selectedAction ? parseActionUID(selectedAction.id) : null),
    [selectedAction]
  );
  const inCapture = Boolean(selectedAction);

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
  const [mediaFeedback, setMediaFeedback] = useState<MediaFeedback | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const canSubmit = garden ? canManageGarden(garden) : false;
  const isLoadingData = Boolean(gardensLoading || actionsLoading);

  const mutation = useWorkMutation({
    authMode,
    gardenAddress: garden?.id ? (garden.id as Address) : null,
    actionUID: selectedActionUID,
    actions,
    userAddress: primaryAddress ?? null,
    completeClientFlow: false,
    allowOfflineQueue: false,
    onProgress: (stage, message) => {
      const i18nKey = `app.admin.work.submit.progress.${stage}`;
      setProgressMessage(formatMessage({ id: i18nKey, defaultMessage: message }));
    },
    onSuccess: (txHash) => {
      if (typeof txHash === "string" && isOfflineTxHash(txHash)) {
        toastService.error({
          title: formatMessage({ id: "app.admin.work.submit.queuedError.title" }),
          message: formatMessage({ id: "app.admin.work.submit.queuedError.message" }),
          context: "admin work submission",
        });
        return;
      }

      toastService.success({
        title: formatMessage({ id: "app.admin.work.submit.success" }),
      });

      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error("Admin work submission failed", { error });
    },
    onSettled: () => {
      setProgressMessage("");
    },
  });

  useBeforeUnloadWhilePending(mutation.isPending || isPreparingMedia);

  // Auto-select when exactly one action is eligible — skip the chooser and land
  // the operator straight in Capture.
  useEffect(() => {
    if (!selectedActionId && availableActions.length === 1) {
      setSelectedActionId(availableActions[0].id);
    }
  }, [availableActions, selectedActionId]);

  // Focus management across the qualify → configure phase boundary: move focus
  // into the newly revealed region so keyboard + screen-reader users follow the
  // flow. Skipped on first mount so we never steal initial focus.
  const phaseRef = useRef<HTMLDivElement>(null);
  const prevInCaptureRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevInCaptureRef.current === null) {
      prevInCaptureRef.current = inCapture;
      return;
    }
    if (prevInCaptureRef.current !== inCapture) {
      prevInCaptureRef.current = inCapture;
      phaseRef.current?.focus();
    }
  }, [inCapture]);

  const onSubmit = handleSubmit((data) => {
    if (!garden || !selectedAction || selectedActionUID === null) return;

    const validationErrors = validateWorkSubmissionContext(
      garden.id as Address,
      selectedActionUID,
      images,
      {
        minRequired: getMinRequiredImages(selectedAction),
      }
    );

    if (validationErrors.length > 0) {
      validationToasts.formError(validationErrors[0]);
      return;
    }

    if (isOffline()) {
      toastService.error({
        title: formatMessage({ id: "app.admin.garden.create.offline.title" }),
        message: formatMessage({
          id: "app.admin.work.submit.offline.message",
          defaultMessage: "Reconnect to the internet before submitting work.",
        }),
        context: "admin work submission",
      });
      return;
    }

    setMediaFeedback(null);

    const actionTitle = getActionTitle(actions, selectedActionUID);
    const { feedback, timeSpentMinutes, ...details } = data as Record<string, unknown>;
    const draft = {
      actionUID: selectedActionUID,
      title: actionTitle,
      timeSpentMinutes: typeof timeSpentMinutes === "number" ? timeSpentMinutes : 0,
      feedback: typeof feedback === "string" ? feedback : "",
      media: images,
      details: details as Record<string, unknown>,
    };

    setProgressMessage(formatMessage({ id: "app.admin.work.submit.progress.validating" }));
    mutation.mutate({ draft, images: images.slice() });
  });

  const handleActionChange = (actionId: string) => {
    setSelectedActionId(actionId);
    resetForm();
    setImages([]);
    setMediaFeedback(null);
    setProgressMessage("");
    mutation.reset();
  };

  const handleFilesChange = useCallback(
    async (newFiles: File[]) => {
      setMediaFeedback(null);
      if (newFiles.length === 0) return;

      const actionIdAtStart = selectedActionIdRef.current;
      const isCurrentAction = () => selectedActionIdRef.current === actionIdAtStart;

      setIsPreparingMedia(true);
      setProgressMessage(formatMessage({ id: "admin.fileUpload.processing" }, { progress: 0 }));

      try {
        const normalized = await normalizeWorkMediaFiles(newFiles, {
          onHeicConversionStarted: () => {
            setProgressMessage(formatMessage({ id: "app.garden.upload.convertingHeic" }));
          },
        });
        if (!isCurrentAction()) return;

        const acceptedFiles = normalized.accepted.map((item) => item.file);
        if (acceptedFiles.length > 0) {
          const preparedFiles = await compressAdminWorkMediaFiles(acceptedFiles, (progress) => {
            setProgressMessage(
              formatMessage(
                { id: "admin.fileUpload.processing", defaultMessage: "Processing... {progress}%" },
                { progress: Math.round(progress) }
              )
            );
          });
          if (!isCurrentAction()) return;
          setImages((prev) => [...prev, ...preparedFiles]);
        }

        const unsupportedCount = normalized.rejected.filter(
          (item) => item.reason === "unsupported"
        ).length;
        const conversionFailureCount = normalized.rejected.filter(
          (item) => item.reason === "heic_conversion_failed"
        ).length;
        const messages: string[] = [];

        if (unsupportedCount > 0) {
          const message = formatMessage(
            {
              id: "app.garden.upload.unsupportedMediaMessage",
              defaultMessage:
                "{count, plural, one {That file is not a supported photo or video.} other {# files are not supported photos or videos.}}",
            },
            { count: unsupportedCount }
          );
          messages.push(message);
          toastService.info({
            title: formatMessage({
              id: "app.garden.upload.unsupportedMediaTitle",
              defaultMessage: "Some files were not added",
            }),
            message,
            context: "admin media upload",
          });
        }

        if (conversionFailureCount > 0) {
          const message = formatMessage(
            {
              id: "app.garden.upload.conversionFailedMessage",
              defaultMessage:
                "{count, plural, one {Try that photo again or choose a different image.} other {Try those photos again or choose different images.}}",
            },
            { count: conversionFailureCount }
          );
          messages.push(message);
          toastService.error({
            title: formatMessage({
              id: "app.garden.upload.conversionFailedTitle",
              defaultMessage: "HEIC photo could not be converted",
            }),
            message,
            context: "admin media upload",
          });
        }

        if (messages.length > 0) {
          setMediaFeedback({
            variant: conversionFailureCount > 0 ? "error" : "warning",
            message: messages.join(" "),
          });
        }
      } catch (error) {
        logger.error("Admin media processing failed", { error });
        const message = formatMessage({
          id: "app.garden.upload.compressionFailedMessage",
          defaultMessage: "Try fewer or smaller images, or check your connection.",
        });
        setMediaFeedback({ variant: "error", message });
        toastService.error({
          title: formatMessage({
            id: "app.garden.upload.compressionFailedTitle",
            defaultMessage: "Couldn't process those images",
          }),
          message,
          context: "admin media upload",
          error,
        });
      } finally {
        setIsPreparingMedia(false);
        setProgressMessage("");
      }
    },
    [formatMessage]
  );

  const title = formatMessage({ id: "app.admin.work.submit.title" });
  const exitLabel = formatMessage({ id: "app.admin.work.submit.backToGarden" });
  // On the mobile route the shell's back-arrow is the only way out, so it exits
  // the flow; in the desktop dialog the AdminDialog close button owns exit, so a
  // first-phase back-arrow is omitted.
  const exitBack = layout === "page" ? () => onCancel?.() : undefined;

  // Loading must win over the empty/not-found branches — both `garden` and
  // `availableActions` are legitimately absent while the lists are still
  // fetching, so resolving them early would flash a false empty state.
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
  if (!isAuthenticated) {
    return (
      <ActionFlowShell
        layout={layout}
        title={title}
        context={garden.name}
        onBack={exitBack}
        backLabel={exitLabel}
      >
        <Alert variant="warning">
          {formatMessage({ id: "app.admin.work.submit.connectWallet" })}
        </Alert>
      </ActionFlowShell>
    );
  }
  if (!canSubmit) {
    return (
      <ActionFlowShell
        layout={layout}
        title={title}
        context={garden.name}
        onBack={exitBack}
        backLabel={exitLabel}
      >
        <Alert variant="warning">
          {formatMessage({ id: "app.admin.work.submit.noPermission" })}
        </Alert>
      </ActionFlowShell>
    );
  }

  // Stable form id so the footer submit button (rendered outside the <form> in
  // the pinned footer) can target the form via the `form="..."` attribute.
  const formId = "submit-work-form";
  const hasActions = availableActions.length > 0;
  const busy = mutation.isPending || isPreparingMedia;
  const photoRequirementText = selectedAction?.mediaInfo?.required
    ? formatMessage(
        { id: "app.admin.work.submit.photosRequired" },
        { count: getMinRequiredImages(selectedAction) }
      )
    : formatMessage({ id: "app.admin.work.submit.photosOptional" });

  if (!hasActions) {
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
          <p className="max-w-sm text-xs text-text-soft">
            {formatMessage({ id: "app.admin.work.submit.noActionsForDomainHint" })}
          </p>
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => navigate(adminRoutes.gardenSettings({ gardenAddress: garden.id }))}
          >
            {formatMessage({ id: "app.admin.work.submit.noActionsForDomain.cta" })}
          </AdminButton>
        </div>
      </ActionFlowShell>
    );
  }

  // Qualify phase — choose which action this work documents. Selecting a card
  // auto-advances to Configure (no Continue step).
  if (!inCapture) {
    return (
      <ActionFlowShell
        layout={layout}
        title={title}
        context={garden.name}
        onBack={exitBack}
        backLabel={exitLabel}
      >
        <div ref={phaseRef} tabIndex={-1} key="choose" className="action-flow-fade outline-none">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-text-strong">
              {formatMessage({ id: "app.admin.work.submit.chooseActionTitle" })}
            </h2>
            <p className="text-sm text-text-soft">
              {formatMessage(
                { id: "app.admin.work.submit.chooseActionDescription" },
                { garden: garden.name }
              )}
            </p>
          </div>
          <div className="mt-4">
            <ActionChooserGrid
              actions={availableActions}
              selectedActionId={selectedActionId}
              onSelect={handleActionChange}
              disabled={busy}
              groupLabel={formatMessage({ id: "app.admin.work.submit.selectAction" })}
            />
          </div>
        </div>
      </ActionFlowShell>
    );
  }

  // Configure phase — stacked FormFlow sections (action details → time & notes →
  // photos) inside one <form>; the pinned footer owns progress + submit.
  const sections: FormFlowSection[] = [];
  if (selectedAction && selectedAction.inputs.length > 0) {
    sections.push({
      id: "details",
      title:
        selectedAction.details?.title ||
        formatMessage({ id: "app.admin.work.submit.section.details" }),
      content: (
        <DynamicWorkFields
          inputs={selectedAction.inputs}
          control={control}
          register={register}
          errors={errors as Record<string, { message?: string } | undefined>}
        />
      ),
    });
  }
  sections.push({
    id: "log",
    title: formatMessage({ id: "app.admin.work.submit.section.log" }),
    content: (
      <div className="space-y-5">
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
    ),
  });
  sections.push({
    id: "photos",
    title:
      selectedAction?.mediaInfo?.title ||
      formatMessage({ id: "app.admin.work.submit.section.photos" }),
    description: photoRequirementText,
    content: (
      <div className="space-y-3">
        <FileUploadField
          label={formatMessage({ id: "app.admin.work.submit.media" })}
          helpText={formatMessage({ id: "app.admin.work.submit.mediaHint" })}
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          multiple
          compress={false}
          showPreview
          currentFiles={images}
          onFilesChange={handleFilesChange}
          onRemoveFile={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
          disabled={busy}
        />
        {mediaFeedback ? (
          <Alert variant={mediaFeedback.variant}>{mediaFeedback.message}</Alert>
        ) : null}
      </div>
    ),
  });

  // Back returns to the chooser when there is one (multiple actions); otherwise
  // it exits the flow on the mobile route / is omitted in the desktop dialog.
  const configureOnBack = availableActions.length > 1 ? () => handleActionChange("") : exitBack;
  const configureBackLabel =
    availableActions.length > 1
      ? formatMessage({ id: "app.admin.work.submit.changeAction" })
      : exitLabel;

  const footer = (
    <>
      <div className="min-w-0 flex-1 space-y-1.5" aria-live="polite">
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
      <div className="flex gap-2">
        <AdminButton type="button" variant="text" onClick={() => onCancel?.()} disabled={busy}>
          {formatMessage({ id: "app.wizard.cancel", defaultMessage: "Cancel" })}
        </AdminButton>
        <AdminButton
          type="submit"
          form={formId}
          variant="filled"
          loading={busy}
          disabled={busy}
          leadingIcon={<RiUploadCloudLine />}
        >
          {mutation.isPending
            ? formatMessage({ id: "app.admin.work.submit.submitting" })
            : formatMessage({ id: "app.admin.work.submit.submit" })}
        </AdminButton>
      </div>
    </>
  );

  return (
    <ActionFlowShell
      layout={layout}
      title={title}
      context={garden.name}
      onBack={configureOnBack}
      backLabel={configureBackLabel}
      backDisabled={busy}
      footer={footer}
    >
      <div ref={phaseRef} tabIndex={-1} key="capture" className="action-flow-fade outline-none">
        <form id={formId} onSubmit={onSubmit}>
          <FormFlow
            layout="bare"
            intro={
              <span>
                <span className="font-semibold text-text-strong">{selectedAction?.title}</span>
                {" · "}
                {photoRequirementText}
              </span>
            }
            feedback={
              mutation.isError ? (
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
                        onClick={() => void onSubmit()}
                        disabled={busy}
                      >
                        {formatMessage({ id: "app.admin.work.submit.retry" })}
                      </AdminButton>
                      <AdminButton
                        type="button"
                        variant="text"
                        size="sm"
                        onClick={() => mutation.reset()}
                        disabled={busy}
                      >
                        {formatMessage({ id: "app.admin.work.submit.editDetails" })}
                      </AdminButton>
                    </div>
                  }
                />
              ) : undefined
            }
            sections={sections}
          />
        </form>
      </div>
    </ActionFlowShell>
  );
}

export default function SubmitWork() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  const hubContext = parseHubContext(location.search);
  const close = () => navigate(adminRoutes.hub(hubContext));

  // Centered 2xl modal with a scrim (bottom-sheet on mobile). The dialog body is
  // neutralized to a flex column with no scroll of its own — ActionFlowShell owns
  // the pinned chrome + scrolling body inside it. The AdminDialog close button is
  // the exit; the multi-phase back-arrow (qualify ← configure) lives in the panel.
  return (
    <AdminDialog
      open
      size="2xl"
      variant="flow"
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={formatMessage({ id: "app.admin.work.submit.title" })}
      description={formatMessage({ id: "app.admin.work.submit.description" })}
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      <SubmitWorkPanel layout="dialog" onSuccess={close} onCancel={close} />
    </AdminDialog>
  );
}
