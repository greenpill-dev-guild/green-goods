import {
  type Action,
  type Address,
  Alert,
  adminRoutes,
  compareAddresses,
  Domain,
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
  useStepFocus,
  useUser,
  useWorkForm,
  useWorkMutation,
  type WorkInput,
} from "@green-goods/shared";
import { validateWorkSubmissionContext } from "@green-goods/shared/modules";
import { RiSeedlingLine, RiUploadCloudLine } from "@remixicon/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminConfirmDialog, AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminTextField } from "@/components/AdminTextField";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { type ActionFlowStep } from "@/components/Layout/ActionFlowStepper";
import { ActionChooserGrid } from "./components/ActionChooserGrid";
import { SubmitWorkReview } from "./components/SubmitWorkReview";

function parseHubContext(search: string) {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const sort = params.get("sort");

  return {
    gardenId: params.get("gardenId") ?? params.get("gardenAddress") ?? undefined,
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

// Domain → shared i18n label key (reuses the Create Assessment domain labels so
// the chooser filter and the assessment domain picker stay in lockstep).
const DOMAIN_TAB_KEYS: Record<Domain, string> = {
  [Domain.SOLAR]: "app.admin.assessment.domainAction.domain.solar",
  [Domain.AGRO]: "app.admin.assessment.domainAction.domain.agroforestry",
  [Domain.EDU]: "app.admin.assessment.domainAction.domain.education",
  [Domain.WASTE]: "app.admin.assessment.domainAction.domain.waste",
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
    () => gardens.find((candidate) => compareAddresses(candidate.id, gardenId)),
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
  // Domain filter for the action chooser — shown only when the garden's eligible
  // actions span more than one domain (mirrors the client's domain tabs).
  const [actionDomain, setActionDomain] = useState<Domain | "all">("all");
  const chooserDomains = useMemo(
    () =>
      Array.from(new Set(availableActions.map((action) => action.domain))).sort((a, b) => a - b),
    [availableActions]
  );
  // Guard a stale filter when the garden switches under the open dialog: if the
  // previously-selected domain isn't among the new garden's domains, fall back to
  // "all" so the chooser never renders an empty radiogroup. Drives both the
  // visible actions and the filter tab's active state.
  const effectiveDomain =
    actionDomain !== "all" && chooserDomains.includes(actionDomain) ? actionDomain : "all";
  const visibleActions = useMemo(
    () =>
      effectiveDomain === "all"
        ? availableActions
        : availableActions.filter((action) => action.domain === effectiveDomain),
    [availableActions, effectiveDomain]
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
  // Stepped flow position (1=Action, 2=Media, 3=Details, 4=Review).
  const [currentStep, setCurrentStep] = useState(1);
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

  // Auto-select when exactly one action is eligible — skip the Action chooser and
  // land the operator straight on the Media step.
  useEffect(() => {
    if (!selectedActionId && availableActions.length === 1) {
      setSelectedActionId(availableActions[0].id);
      setCurrentStep((step) => (step === 1 ? 2 : step));
    }
  }, [availableActions, selectedActionId]);

  // Move focus into the newly revealed step region on step change (shared hook,
  // also used by Create Assessment + Create Hypercert) so keyboard + SR users
  // follow the flow instead of staying on the Next button.
  const phaseRef = useStepFocus<HTMLDivElement>(currentStep);

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

  // Stepped flow: Action → Media → Details → Review. The selected action's form
  // fields live on the Details step, but react-hook-form keeps unmounted-field
  // values, so Review + submit read the full snapshot.
  const stepConfigs: ActionFlowStep[] = [
    {
      id: "action",
      title: formatMessage({ id: "app.admin.work.submit.step.action", defaultMessage: "Action" }),
    },
    {
      id: "media",
      title: formatMessage({ id: "app.admin.work.submit.step.media", defaultMessage: "Media" }),
    },
    {
      id: "details",
      title: formatMessage({ id: "app.admin.work.submit.step.details", defaultMessage: "Details" }),
    },
    {
      id: "review",
      title: formatMessage({ id: "app.admin.work.submit.step.review", defaultMessage: "Review" }),
    },
  ];
  const activeStepId = stepConfigs[currentStep - 1]?.id ?? "action";
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === stepConfigs.length;

  // Select in place (no auto-advance) — selecting marks the card and the footer
  // Next advances, so a misclick is recoverable and the selected state is visible.
  // Switching to a different action resets the draft.
  const handleSelectAction = (actionId: string) => {
    if (!actionId) return;
    if (actionId !== selectedActionId) handleActionChange(actionId);
  };

  const goBack = () => {
    if (busy) return;
    setCurrentStep((step) => Math.max(1, step - 1));
  };
  const goNext = async () => {
    if (busy) return;
    // Gate the required photos at the Media step — otherwise the operator only
    // learns at submit, after walking Details + Review. Reuses the inline media
    // Alert (role="alert"), not a deferred toast.
    if (activeStepId === "media") {
      const minRequired = getMinRequiredImages(selectedAction);
      if (minRequired > 0 && images.length < minRequired) {
        setMediaFeedback({
          variant: "error",
          message: formatMessage(
            {
              id: "app.admin.work.submit.mediaRequiredError",
              defaultMessage:
                "{count, plural, one {Add at least # photo to continue.} other {Add at least # photos to continue.}}",
            },
            { count: minRequired }
          ),
        });
        return;
      }
    }
    // Validate the work form before leaving Details for Review.
    if (activeStepId === "details") {
      const valid = await form.trigger();
      if (!valid) return;
    }
    setCurrentStep((step) => Math.min(stepConfigs.length, step + 1));
  };
  const handleStepJump = (step: number) => {
    if (busy || step >= currentStep) return;
    setCurrentStep(step);
  };

  const nextDisabled = busy || (activeStepId === "action" && !selectedAction);

  const footer = (
    // Mobile: status on top, a compact secondary, then a full-width primary CTA
    // (thumb-reachable, in the client-PWA spirit). Desktop: status left, the
    // button pair right — the original row. SheetFooter is a fixed inline-flex
    // row, so this single w-full child owns the responsive layout.
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
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-text-strong">
            {formatMessage({ id: "app.admin.work.submit.chooseActionTitle" })}
          </h2>
          <p className="text-sm text-text-sub">
            {formatMessage({ id: "app.admin.work.submit.chooseActionDescription" })}
          </p>
        </div>
        {chooserDomains.length > 1 ? (
          <AdminTabRail
            ariaLabel={formatMessage({ id: "app.admin.assessment.domainAction.domainTitle" })}
            activeId={effectiveDomain === "all" ? "all" : String(effectiveDomain)}
            onChange={(id) => setActionDomain(id === "all" ? "all" : (Number(id) as Domain))}
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
        {/* SR-only live status — the domain tablist swaps the radiogroup with no
            inherent announcement, so report the visible count when the filter
            changes (the tablist→radiogroup pair has no aria-controls bridge). */}
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
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-text-strong">
            {selectedAction?.mediaInfo?.title ||
              formatMessage({ id: "app.admin.work.submit.section.photos" })}
          </h2>
          <p className="text-sm text-text-sub">{photoRequirementText}</p>
        </div>
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
    );
  } else if (activeStepId === "details") {
    stepBody = (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-text-strong">
            {selectedAction?.details?.title ||
              formatMessage({ id: "app.admin.work.submit.section.details" })}
          </h2>
          {selectedAction?.title ? (
            <p className="text-sm text-text-sub">{selectedAction.title}</p>
          ) : null}
        </div>
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
        values={form.getValues() as Record<string, unknown>}
        photoRequirementText={photoRequirementText}
        onEditStep={(step) => {
          if (!busy) setCurrentStep(step);
        }}
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
      <form id={formId} onSubmit={onSubmit}>
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
          ) : null}
          {stepBody}
        </div>
      </form>
    </ActionFlowShell>
  );
}

export default function SubmitWork() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  const hubContext = parseHubContext(location.search);
  const close = () => navigate(adminRoutes.hub(hubContext));
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Centered flow modal with a scrim (bottom-sheet on mobile) — width comes from
  // ADMIN_FLOW_DIALOG_CLASS, not the size prop below. The dialog body is
  // neutralized to a flex column with no scroll of its own — ActionFlowShell owns
  // the pinned chrome + scrolling body inside it. The X / backdrop routes through a
  // discard confirm so a submission can't be lost to an accidental close; the
  // explicit Cancel button still exits directly.
  return (
    <>
      <AdminDialog
        open
        size="lg"
        variant="flow"
        tone="garden"
        className={ADMIN_FLOW_DIALOG_CLASS}
        onOpenChange={(next) => {
          if (!next) setShowDiscardConfirm(true);
        }}
        title={formatMessage({ id: "app.admin.work.submit.title" })}
        description={formatMessage({ id: "app.admin.work.submit.description" })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        <SubmitWorkPanel layout="dialog" onSuccess={close} onCancel={close} />
      </AdminDialog>
      <AdminConfirmDialog
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={close}
        title={formatMessage({
          id: "app.admin.flow.discardChanges.title",
          defaultMessage: "Discard changes?",
        })}
        description={formatMessage({
          id: "app.admin.flow.discardChanges.description",
          defaultMessage: "Any unsaved changes will be lost.",
        })}
        confirmLabel={formatMessage({
          id: "app.admin.flow.discardChanges.confirm",
          defaultMessage: "Discard",
        })}
        cancelLabel={formatMessage({
          id: "app.admin.flow.discardChanges.cancel",
          defaultMessage: "Keep editing",
        })}
        variant="warning"
      />
    </>
  );
}
