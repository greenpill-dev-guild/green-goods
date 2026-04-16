import {
  type ActionInstructionConfig,
  DEFAULT_CHAIN_ID,
  defaultTemplate,
  Surface,
  fromDateTimeLocalValue,
  getFileByHash,
  instructionTemplates,
  logger,
  toastService,
  toDateTimeLocalValue,
  toSafeDate,
  uploadFileToIPFS,
  useActionOperations,
  useActions,
  useAsyncEffect,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { InstructionsBuilder } from "@/components/Action/InstructionsBuilder";
import { AdminButton } from "@/components/AdminButton";
import { AdminTextField } from "@/components/AdminTextField";
import { PageHeader } from "@/components/Layout/PageHeader";

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

export default function EditAction() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  // Sync form state when action data loads or changes
  useAsyncEffect(
    async ({ isMounted }) => {
      if (!action) return;
      const fallbackConfig = cloneInstructionConfig(
        instructionTemplates[action.slug] ?? defaultTemplate
      );

      form.reset({
        title: action.title || "",
        startTime: toSafeDate(action.startTime) ?? new Date(),
        endTime: toSafeDate(action.endTime) ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      if (isMounted()) {
        setInstructionConfig(fallbackConfig);
      }

      if (!action.instructions) return;

      setIsLoadingInstructions(true);
      try {
        const file = await getFileByHash(action.instructions, {
          timeoutMs: INSTRUCTION_LOAD_TIMEOUT_MS,
        });
        const config = await parseInstructionConfig(file.data);
        if (isMounted()) {
          if (config) {
            setInstructionConfig(config);
          } else {
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
        }
      }
    },
    [action?.id, action?.instructions]
  );

  if (actionsLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-text-sub">{formatMessage({ id: "app.actions.loading" })}</p>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="text-center py-12">
        <p className="text-text-sub">{formatMessage({ id: "app.actions.notFound" })}</p>
        <Link to="/actions" className="text-primary-base hover:underline mt-2 inline-block">
          {formatMessage({ id: "app.actions.backToActions" })}
        </Link>
      </div>
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
      navigate(`/actions/${id}`);
    } catch (error) {
      logger.error("Failed to update action", { error });
      toastService.error({ title: formatMessage({ id: "app.actions.edit.failed" }) });
    }
  };

  return (
    <div>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <PageHeader
          title={formatMessage({ id: "app.actions.edit.title" }, { name: action.title })}
          description={formatMessage({
            id: "cockpit.actions.editDescription",
            defaultMessage: "Update lifecycle details and the submission contract for this action.",
          })}
          variant="canvas"
          backLink={{
            to: `/actions/${id}`,
            label: formatMessage({
              id: "app.actions.backToAction",
              defaultMessage: "Back to action",
            }),
          }}
          sticky
        />
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto mt-4 max-w-5xl space-y-4 px-4 sm:px-6"
      >
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

            <div className="grid grid-cols-2 gap-4">
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
          <div className="flex items-center justify-between mb-4">
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
            <p className="text-text-sub text-sm">
              {formatMessage({ id: "app.actions.edit.loadingInstructions" })}
            </p>
          ) : isEditingInstructions ? (
            <InstructionsBuilder value={instructionConfig} onChange={setInstructionConfig} />
          ) : (
            <p className="text-text-sub text-sm">
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
          <AdminButton type="button" variant="outlined" onClick={() => navigate(`/actions/${id}`)}>
            {formatMessage({ id: "app.common.cancel" })}
          </AdminButton>
        </Surface>
      </form>
    </div>
  );
}
