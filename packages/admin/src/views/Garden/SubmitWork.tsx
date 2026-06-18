import {
  type Action,
  type Address,
  Alert,
  adminRoutes,
  Card,
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
  SheetBody,
  SheetFooter,
  Textarea,
  toastService,
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
import { RiUploadCloudLine } from "@remixicon/react";
import { useCallback, useMemo, useRef, useState } from "react";
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

type SubmitWorkLayout = "page" | "sheet";
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

  const { data: gardens = [] } = useGardens();
  const { data: actions = [] } = useActions();
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

  const onSubmit = handleSubmit((data) => {
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

    if (!selectedAction || selectedActionUID === null) return;

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

  // Shared field stack — identical grouping in both layouts so the form reads
  // the same on the page route and inside the Hub LeftSheet: action picker →
  // action-specific fields → effort/notes → media evidence.
  const formFields = (
    <>
      <FormField
        label={formatMessage({ id: "app.admin.work.submit.selectAction" })}
        htmlFor="action-select"
        required
      >
        {availableActions.length === 0 ? (
          <Alert
            variant="info"
            action={
              <AdminButton
                type="button"
                variant="text"
                size="sm"
                onClick={() => navigate(adminRoutes.gardenSettings({ gardenAddress: garden.id }))}
              >
                {formatMessage({ id: "app.admin.work.submit.noActionsForDomain.cta" })}
              </AdminButton>
            }
          >
            {formatMessage({ id: "app.admin.work.submit.noActionsForDomain" })}
          </Alert>
        ) : (
          <NativeSelect
            surface="admin"
            id="action-select"
            value={selectedActionId}
            disabled={mutation.isPending || isPreparingMedia}
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
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            compress={false}
            showPreview
            currentFiles={images}
            onFilesChange={handleFilesChange}
            onRemoveFile={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
            disabled={mutation.isPending || isPreparingMedia}
          />
          {mediaFeedback ? (
            <Alert variant={mediaFeedback.variant}>{mediaFeedback.message}</Alert>
          ) : null}
        </>
      ) : null}
    </>
  );

  const footerActions = (
    <>
      <AdminButton
        type="button"
        variant="text"
        onClick={() => onCancel?.()}
        disabled={mutation.isPending || isPreparingMedia}
      >
        {formatMessage({ id: "app.wizard.cancel", defaultMessage: "Cancel" })}
      </AdminButton>
      <AdminButton
        type="submit"
        form={formId}
        variant="filled"
        loading={mutation.isPending || isPreparingMedia}
        disabled={mutation.isPending || isPreparingMedia || availableActions.length === 0}
        leadingIcon={<RiUploadCloudLine />}
      >
        {mutation.isPending
          ? formatMessage({ id: "app.admin.work.submit.submitting" })
          : formatMessage({ id: "app.admin.work.submit.submit" })}
      </AdminButton>
    </>
  );

  const progressSlot = (
    <div className="min-w-0 flex-1" aria-live="polite">
      {progressMessage ? (
        <p className="truncate text-sm text-text-sub" title={progressMessage}>
          {progressMessage}
        </p>
      ) : null}
    </div>
  );

  if (layout === "page") {
    return (
      <CanvasRouteContent maxWidthClassName="max-w-2xl" className="mt-6">
        <form id={formId} onSubmit={onSubmit}>
          <Card>
            <Card.Body className="space-y-5">{formFields}</Card.Body>
            {selectedAction ? (
              <Card.Footer className="flex items-center justify-between gap-3">
                {progressSlot}
                <div className="flex gap-2">{footerActions}</div>
              </Card.Footer>
            ) : null}
          </Card>
        </form>
      </CanvasRouteContent>
    );
  }

  // Sheet layout: admin sheet/form anatomy — fields sit directly on the sheet
  // surface (no nested card), scroll inside SheetBody, and commit through the
  // pinned SheetFooter. The submit button targets the form by id because the
  // footer sits outside the form element.
  return (
    <>
      <SheetBody>
        <form id={formId} onSubmit={onSubmit} className="space-y-5">
          {formFields}
        </form>
      </SheetBody>
      {selectedAction ? (
        <SheetFooter>
          {progressSlot}
          {footerActions}
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
