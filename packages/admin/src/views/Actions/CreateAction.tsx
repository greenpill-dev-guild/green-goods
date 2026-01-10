import {
  cn,
  DEFAULT_CHAIN_ID,
  defaultTemplate,
  instructionTemplates,
  toastService,
  uploadFileToIPFS,
} from "@green-goods/shared";
import { useActionOperations } from "@green-goods/shared/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { InstructionsBuilder } from "@/components/Action/InstructionsBuilder";
import { FormWizard } from "@/components/Form/FormWizard";
import type { Step } from "@/components/Form/StepIndicator";
import { FileUploadField } from "@/components/FileUploadField";

const createActionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startTime: z.date(),
  endTime: z.date(),
  capitals: z.array(z.number()).min(1, "Select at least one capital"),
  media: z.array(z.instanceof(File)).min(1, "At least one image required"),
  instructionConfig: z.object({
    description: z.string(),
    uiConfig: z.object({
      media: z.object({
        title: z.string(),
        description: z.string(),
        maxImageCount: z.number(),
        minImageCount: z.number(),
        required: z.boolean(),
        needed: z.array(z.string()),
        optional: z.array(z.string()),
      }),
      details: z.object({
        title: z.string(),
        description: z.string(),
        feedbackPlaceholder: z.string(),
        inputs: z.array(z.any()),
      }),
      review: z.object({
        title: z.string(),
        description: z.string(),
      }),
    }),
  }),
});

type CreateActionForm = z.infer<typeof createActionSchema>;

const stepConfigs: Step[] = [
  { id: "basics", title: "Basics", description: "Title and timeline" },
  { id: "capitals", title: "Capitals & Media", description: "Forms of capital and images" },
  { id: "instructions", title: "Instructions", description: "Define work submission form" },
  { id: "review", title: "Review", description: "Confirm and submit" },
];

export default function CreateAction() {
  const navigate = useNavigate();
  const { registerAction, isLoading } = useActionOperations(DEFAULT_CHAIN_ID);
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm<CreateActionForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createActionSchema as any) as any,
    defaultValues: {
      title: "",
      startTime: new Date(),
      endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      capitals: [],
      media: [],
      instructionConfig: defaultTemplate,
    },
  });

  const onSubmit = async (data: CreateActionForm) => {
    try {
      // Upload media to IPFS
      toastService.loading({ title: "Uploading media to IPFS..." });
      const mediaUploads = await Promise.all(
        data.media.map((file: File) => uploadFileToIPFS(file))
      );
      const mediaCIDs = mediaUploads.map((upload: { cid: string }) => upload.cid);

      // Convert instruction config to JSON and upload to IPFS
      const instructionsBlob = new Blob([JSON.stringify(data.instructionConfig, null, 2)], {
        type: "application/json",
      });
      const instructionsFile = new File([instructionsBlob], "instructions.json", {
        type: "application/json",
      });
      const instructionsUpload = await uploadFileToIPFS(instructionsFile);
      const instructionsCID = instructionsUpload.cid;

      toastService.dismiss();

      // Register action on-chain
      await registerAction({
        title: data.title,
        startTime: Math.floor(data.startTime.getTime() / 1000),
        endTime: Math.floor(data.endTime.getTime() / 1000),
        capitals: data.capitals,
        media: mediaCIDs,
        instructions: instructionsCID,
      });

      navigate("/actions");
    } catch (error) {
      console.error("Failed to create action:", error);
      toastService.error({ title: "Failed to create action" });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="create-action-title"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                Title
              </label>
              <input
                id="create-action-title"
                {...form.register("title")}
                type="text"
                className="w-full rounded-md border border-stroke-soft px-3 py-2"
                placeholder="Action title"
              />
              {form.formState.errors.title && (
                <p className="text-error-base text-sm mt-1">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="create-action-starttime"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                Start Date
              </label>
              <input
                id="create-action-starttime"
                {...form.register("startTime", { valueAsDate: true })}
                type="date"
                className="w-full rounded-md border border-stroke-soft px-3 py-2"
              />
              {form.formState.errors.startTime && (
                <p className="text-error-base text-sm mt-1">
                  {form.formState.errors.startTime.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="create-action-endtime"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                End Date
              </label>
              <input
                id="create-action-endtime"
                {...form.register("endTime", { valueAsDate: true })}
                type="date"
                className="w-full rounded-md border border-stroke-soft px-3 py-2"
              />
              {form.formState.errors.endTime && (
                <p className="text-error-base text-sm mt-1">
                  {form.formState.errors.endTime.message}
                </p>
              )}
            </div>
          </div>
        );

      case 1:
        const capitals = form.watch("capitals");
        const CAPITALS_OPTIONS = [
          { value: 0, label: "Social" },
          { value: 1, label: "Material" },
          { value: 2, label: "Financial" },
          { value: 3, label: "Living" },
          { value: 4, label: "Intellectual" },
          { value: 5, label: "Experiential" },
          { value: 6, label: "Spiritual" },
          { value: 7, label: "Cultural" },
        ];

        return (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="create-action-capitals"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                Forms of Capital <span className="text-error-base">*</span>
              </label>
              <p className="text-xs text-text-soft mb-3">
                Select the forms of capital associated with this action
              </p>
              <fieldset
                id="create-action-capitals"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {CAPITALS_OPTIONS.map((capital) => {
                  const isChecked = capitals.includes(capital.value);
                  return (
                    <label
                      key={capital.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition",
                        isChecked
                          ? "border-success-base bg-success-lighter text-success-dark"
                          : "border-stroke-soft bg-bg-white text-text-sub hover:border-success-light hover:bg-success-lighter/30"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const newCapitals = e.target.checked
                            ? [...capitals, capital.value]
                            : capitals.filter((c) => c !== capital.value);
                          form.setValue("capitals", newCapitals);
                        }}
                        className="h-4 w-4 rounded border-stroke-sub text-success-base focus:ring-2 focus:ring-success-light focus:ring-offset-0"
                      />
                      <span className="flex-1 truncate font-medium">{capital.label}</span>
                    </label>
                  );
                })}
              </fieldset>
              {form.formState.errors.capitals && (
                <p className="text-error-base text-sm mt-1">
                  {form.formState.errors.capitals.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="create-action-media"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                Media (Images)
              </label>
              <FileUploadField
                id="create-action-media"
                currentFiles={form.watch("media")}
                onFilesChange={(files: File[]) => form.setValue("media", files)}
                onRemoveFile={(index: number) => {
                  const current = form.getValues("media");
                  form.setValue(
                    "media",
                    current.filter((_, i) => i !== index)
                  );
                }}
                accept="image/*"
                multiple
                showPreview
                compress
              />
              {form.formState.errors.media && (
                <p className="text-error-base text-sm mt-1">
                  {form.formState.errors.media.message}
                </p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <div className="mb-4">
              <label
                htmlFor="create-action-template"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                Start from a template (optional)
              </label>
              <select
                id="create-action-template"
                onChange={(e) => {
                  if (e.target.value) {
                    form.setValue("instructionConfig", instructionTemplates[e.target.value]);
                  }
                }}
                className="w-full rounded-md border border-stroke-soft px-3 py-2"
              >
                <option value="">Keep current configuration</option>
                <option value="plantingAction">Planting Action</option>
                <option value="wateringAction">Watering Action</option>
                <option value="harvestAction">Harvest Action</option>
              </select>
            </div>
            <InstructionsBuilder
              value={form.watch("instructionConfig")}
              onChange={(config) => form.setValue("instructionConfig", config)}
            />
          </div>
        );

      case 3:
        const data = form.getValues();
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-text-strong">Title</h3>
              <p className="text-text-sub">{data.title}</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-strong">Timeline</h3>
              <p className="text-text-sub">
                {data.startTime.toLocaleDateString()} - {data.endTime.toLocaleDateString()}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-strong">Capitals</h3>
              <p className="text-text-sub">{data.capitals.length} selected</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-strong">Media</h3>
              <p className="text-text-sub">{data.media.length} files</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-strong">Form Inputs</h3>
              <p className="text-text-sub">
                {data.instructionConfig.uiConfig.details.inputs.length} custom fields
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, stepConfigs.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCancel = () => {
    navigate("/actions");
  };

  return (
    <FormWizard
      steps={stepConfigs}
      currentStep={currentStep}
      onNext={handleNext}
      onBack={handleBack}
      onCancel={handleCancel}
      onSubmit={form.handleSubmit(onSubmit)}
      isSubmitting={isLoading}
    >
      {renderStep()}
    </FormWizard>
  );
}
