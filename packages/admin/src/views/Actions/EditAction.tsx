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
  const { data: actions = [] } = useActions(DEFAULT_CHAIN_ID);
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
            title: "Failed to load instructions",
            description: "Using default template instead",
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

  if (!action) {
    return (
      <div className="text-center py-12">
        <p className="text-text-sub">Action not found</p>
        <Link to="/actions" className="text-green-600 hover:underline mt-2 inline-block">
          Back to Actions
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
        toastService.loading({ title: "Uploading new instructions to IPFS..." });
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

      toastService.success({ title: "Action updated successfully" });
      navigate(`/actions/${id}`);
    } catch (error) {
      logger.error("Failed to update action", { error });
      toastService.error({ title: "Failed to update action" });
    }
  };

  return (
    <div>
      <PageHeader title={`Edit: ${action.title}`} description="Update action details" />

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 max-w-4xl space-y-6">
        {/* Basic Fields */}
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="action-title"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                Title
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
                  Start Time
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
                  End Time
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
            <h3 className="text-lg font-semibold">Instructions Configuration</h3>
            {!isLoadingInstructions && (
              <button
                type="button"
                onClick={() => setIsEditingInstructions(!isEditingInstructions)}
                className="text-sm text-green-600 hover:text-green-700"
              >
                {isEditingInstructions ? "Cancel editing" : "Edit instructions"}
              </button>
            )}
          </div>

          {isLoadingInstructions ? (
            <p className="text-text-sub text-sm">Loading instructions...</p>
          ) : isEditingInstructions ? (
            <InstructionsBuilder value={instructionConfig} onChange={setInstructionConfig} />
          ) : (
            <p className="text-text-sub text-sm">
              Click &quot;Edit instructions&quot; to modify the work submission form configuration.
              This will create a new version of the instructions.
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
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/actions/${id}`)}
            className="rounded-md border border-stroke-soft px-4 py-2 text-sm font-medium text-text-strong hover:bg-bg-soft"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
