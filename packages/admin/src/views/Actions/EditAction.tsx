import {
  DEFAULT_CHAIN_ID,
  defaultTemplate,
  fromDateTimeLocalValue,
  logger,
  toastService,
  toDateTimeLocalValue,
  toSafeDate,
  uploadFileToIPFS,
  useActionOperations,
  useActions,
  useAsyncEffect,
  type ActionInstructionConfig,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { InstructionsBuilder } from "@/components/Action/InstructionsBuilder";
import { PageHeader } from "@/components/Layout/PageHeader";

const editActionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

type EditActionFormData = z.infer<typeof editActionSchema>;

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

      form.reset({
        title: action.title || "",
        startTime: toSafeDate(action.startTime) ?? new Date(),
        endTime: toSafeDate(action.endTime) ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      if (!action.instructions) return;

      setIsLoadingInstructions(true);
      try {
        const response = await fetch(action.instructions);
        const config = await response.json();
        if (isMounted()) {
          setInstructionConfig(config);
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
        <Link to="/actions" className="text-green-600 hover:underline mt-2 inline-block">
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
      <PageHeader
        title={formatMessage({ id: "app.actions.edit.title" }, { name: action.title })}
        description={formatMessage({ id: "app.actions.edit.description" })}
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 max-w-4xl space-y-6">
        {/* Basic Fields */}
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
          <h3 className="text-lg font-semibold mb-4">
            {formatMessage({ id: "app.actions.edit.basicInfo" })}
          </h3>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="action-title"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                {formatMessage({ id: "app.assessment.table.title" })}
              </label>
              <input
                id="action-title"
                type="text"
                {...form.register("title")}
                className="w-full rounded-md border border-stroke-soft px-3 py-2"
              />
              {form.formState.errors.title && (
                <p className="mt-1 text-xs text-error-base">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="action-start-time"
                  className="block text-sm font-medium text-text-strong mb-2"
                >
                  {formatMessage({ id: "app.actions.detail.startTime" })}
                </label>
                <input
                  id="action-start-time"
                  type="datetime-local"
                  value={toDateTimeLocalValue(form.watch("startTime").getTime())}
                  onChange={(e) =>
                    form.setValue("startTime", fromDateTimeLocalValue(e.target.value))
                  }
                  className="w-full rounded-md border border-stroke-soft px-3 py-2"
                />
              </div>

              <div>
                <label
                  htmlFor="action-end-time"
                  className="block text-sm font-medium text-text-strong mb-2"
                >
                  {formatMessage({ id: "app.actions.detail.endTime" })}
                </label>
                <input
                  id="action-end-time"
                  type="datetime-local"
                  value={toDateTimeLocalValue(form.watch("endTime").getTime())}
                  onChange={(e) => form.setValue("endTime", fromDateTimeLocalValue(e.target.value))}
                  className="w-full rounded-md border border-stroke-soft px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Instructions Configuration */}
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {formatMessage({ id: "app.actions.edit.instructionsConfig" })}
            </h3>
            {!isLoadingInstructions && (
              <button
                type="button"
                onClick={() => setIsEditingInstructions(!isEditingInstructions)}
                className="text-sm text-green-600 hover:text-green-700"
              >
                {isEditingInstructions
                  ? formatMessage({ id: "app.actions.edit.cancelEditing" })
                  : formatMessage({ id: "app.actions.edit.editInstructions" })}
              </button>
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
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading
              ? formatMessage({ id: "app.actions.edit.saving" })
              : formatMessage({ id: "app.actions.edit.saveChanges" })}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/actions/${id}`)}
            className="rounded-md border border-stroke-soft px-4 py-2 text-sm font-medium text-text-strong hover:bg-bg-soft"
          >
            {formatMessage({ id: "app.common.cancel" })}
          </button>
        </div>
      </form>
    </div>
  );
}
