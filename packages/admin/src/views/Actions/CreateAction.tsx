import {
  cn,
  createActionSchema,
  DEFAULT_CHAIN_ID,
  defaultTemplate,
  instructionTemplates,
  logger,
  toastService,
  uploadFileToIPFS,
  useActionOperations,
  type CreateActionFormData,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { InstructionsBuilder } from "@/components/Action/InstructionsBuilder";
import { FormWizard } from "@/components/Form/FormWizard";
import type { Step } from "@/components/Form/StepIndicator";
import { FileUploadField } from "@/components/FileUploadField";

export default function CreateAction() {
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { registerAction, isLoading } = useActionOperations(DEFAULT_CHAIN_ID);
  const [currentStep, setCurrentStep] = useState(0);

  const stepConfigs: Step[] = [
    {
      id: "basics",
      title: formatMessage({ id: "app.admin.actions.create.stepBasics", defaultMessage: "Basics" }),
      description: formatMessage({
        id: "app.admin.actions.create.stepBasicsDesc",
        defaultMessage: "Title and timeline",
      }),
    },
    {
      id: "capitals",
      title: formatMessage({
        id: "app.admin.actions.create.stepCapitals",
        defaultMessage: "Capitals & Media",
      }),
      description: formatMessage({
        id: "app.admin.actions.create.stepCapitalsDesc",
        defaultMessage: "Forms of capital and images",
      }),
    },
    {
      id: "instructions",
      title: formatMessage({
        id: "app.admin.actions.create.stepInstructions",
        defaultMessage: "Instructions",
      }),
      description: formatMessage({
        id: "app.admin.actions.create.stepInstructionsDesc",
        defaultMessage: "Define work submission form",
      }),
    },
    {
      id: "review",
      title: formatMessage({ id: "app.admin.actions.create.stepReview", defaultMessage: "Review" }),
      description: formatMessage({
        id: "app.admin.actions.create.stepReviewDesc",
        defaultMessage: "Confirm and submit",
      }),
    },
  ];

  const form = useForm<CreateActionFormData>({
    resolver: zodResolver(createActionSchema),
    defaultValues: {
      title: "",
      startTime: new Date(),
      endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      capitals: [],
      media: [],
      instructionConfig: defaultTemplate,
    },
  });

  const onSubmit = async (data: CreateActionFormData) => {
    try {
      // Upload media to IPFS
      toastService.loading({
        title: formatMessage({
          id: "app.admin.actions.create.uploadingMedia",
          defaultMessage: "Uploading media to IPFS...",
        }),
      });
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
      logger.error("Failed to create action", {
        source: "CreateAction.onSubmit",
        error: error instanceof Error ? error.message : String(error),
        title: data.title,
        mediaCount: data.media.length,
      });
      toastService.error({
        title: formatMessage({
          id: "app.admin.actions.create.errorTitle",
          defaultMessage: "Failed to create action",
        }),
        context: formatMessage({
          id: "app.admin.actions.create.errorContext",
          defaultMessage: "action creation",
        }),
        error,
      });
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
                {formatMessage({
                  id: "app.admin.actions.create.titleLabel",
                  defaultMessage: "Title",
                })}
              </label>
              <input
                id="create-action-title"
                {...form.register("title")}
                type="text"
                className="w-full rounded-md border border-stroke-soft px-3 py-2"
                placeholder={formatMessage({
                  id: "app.admin.actions.create.titlePlaceholder",
                  defaultMessage: "Action title",
                })}
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
                {formatMessage({
                  id: "app.admin.actions.create.startDateLabel",
                  defaultMessage: "Start Date",
                })}
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
                {formatMessage({
                  id: "app.admin.actions.create.endDateLabel",
                  defaultMessage: "End Date",
                })}
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

      case 1: {
        const capitals = form.watch("capitals");
        const CAPITALS_OPTIONS = [
          {
            value: 0,
            label: formatMessage({
              id: "app.admin.actions.create.capitalSocial",
              defaultMessage: "Social",
            }),
          },
          {
            value: 1,
            label: formatMessage({
              id: "app.admin.actions.create.capitalMaterial",
              defaultMessage: "Material",
            }),
          },
          {
            value: 2,
            label: formatMessage({
              id: "app.admin.actions.create.capitalFinancial",
              defaultMessage: "Financial",
            }),
          },
          {
            value: 3,
            label: formatMessage({
              id: "app.admin.actions.create.capitalLiving",
              defaultMessage: "Living",
            }),
          },
          {
            value: 4,
            label: formatMessage({
              id: "app.admin.actions.create.capitalIntellectual",
              defaultMessage: "Intellectual",
            }),
          },
          {
            value: 5,
            label: formatMessage({
              id: "app.admin.actions.create.capitalExperiential",
              defaultMessage: "Experiential",
            }),
          },
          {
            value: 6,
            label: formatMessage({
              id: "app.admin.actions.create.capitalSpiritual",
              defaultMessage: "Spiritual",
            }),
          },
          {
            value: 7,
            label: formatMessage({
              id: "app.admin.actions.create.capitalCultural",
              defaultMessage: "Cultural",
            }),
          },
        ];

        return (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="create-action-capitals"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                {formatMessage({
                  id: "app.admin.actions.create.capitalsLabel",
                  defaultMessage: "Forms of Capital",
                })}{" "}
                <span className="text-error-base">*</span>
              </label>
              <p className="text-xs text-text-soft mb-3">
                {formatMessage({
                  id: "app.admin.actions.create.capitalsDescription",
                  defaultMessage: "Select the forms of capital associated with this action",
                })}
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
                {formatMessage({
                  id: "app.admin.actions.create.mediaLabel",
                  defaultMessage: "Media (Images)",
                })}
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
      }

      case 2:
        return (
          <div>
            <div className="mb-4">
              <label
                htmlFor="create-action-template"
                className="block text-sm font-medium text-text-strong mb-2"
              >
                {formatMessage({
                  id: "app.admin.actions.create.templateLabel",
                  defaultMessage: "Start from a template (optional)",
                })}
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
                <option value="">
                  {formatMessage({
                    id: "app.admin.actions.create.templateKeepCurrent",
                    defaultMessage: "Keep current configuration",
                  })}
                </option>
                <optgroup
                  label={formatMessage({
                    id: "app.admin.actions.create.templateGroupSolar",
                    defaultMessage: "Solar",
                  })}
                >
                  <option value="solar.site_setup">
                    {formatMessage({
                      id: "app.admin.actions.create.templateSolarSiteSetup",
                      defaultMessage: "Site & Readiness Setup",
                    })}
                  </option>
                  <option value="solar.install_milestone">
                    {formatMessage({
                      id: "app.admin.actions.create.templateSolarInstallMilestone",
                      defaultMessage: "Infrastructure Milestone",
                    })}
                  </option>
                  <option value="solar.service_session">
                    {formatMessage({
                      id: "app.admin.actions.create.templateSolarServiceSession",
                      defaultMessage: "Hub Service Session",
                    })}
                  </option>
                  <option value="solar.energy_uptime_check">
                    {formatMessage({
                      id: "app.admin.actions.create.templateSolarEnergyCheck",
                      defaultMessage: "Energy & Uptime Check",
                    })}
                  </option>
                  <option value="solar.node_ops">
                    {formatMessage({
                      id: "app.admin.actions.create.templateSolarNodeOps",
                      defaultMessage: "Node Operation Log",
                    })}
                  </option>
                </optgroup>
                <optgroup
                  label={formatMessage({
                    id: "app.admin.actions.create.templateGroupAgro",
                    defaultMessage: "Agroforestry",
                  })}
                >
                  <option value="agro.site_species_plan">
                    {formatMessage({
                      id: "app.admin.actions.create.templateAgroSitePlan",
                      defaultMessage: "Site Assessment & Species Plan",
                    })}
                  </option>
                  <option value="agro.planting_event">
                    {formatMessage({
                      id: "app.admin.actions.create.templateAgroPlanting",
                      defaultMessage: "Planting Event",
                    })}
                  </option>
                  <option value="agro.survival_check">
                    {formatMessage({
                      id: "app.admin.actions.create.templateAgroSurvival",
                      defaultMessage: "Survival Check",
                    })}
                  </option>
                  <option value="agro.maintenance_activity">
                    {formatMessage({
                      id: "app.admin.actions.create.templateAgroMaintenance",
                      defaultMessage: "Maintenance Activity",
                    })}
                  </option>
                  <option value="agro.learning_reflection">
                    {formatMessage({
                      id: "app.admin.actions.create.templateAgroLearning",
                      defaultMessage: "Learning Reflection",
                    })}
                  </option>
                  <option value="agro.harvest_yield">
                    {formatMessage({
                      id: "app.admin.actions.create.templateAgroHarvest",
                      defaultMessage: "Harvest & Yield Record",
                    })}
                  </option>
                </optgroup>
                <optgroup
                  label={formatMessage({
                    id: "app.admin.actions.create.templateGroupEdu",
                    defaultMessage: "Education",
                  })}
                >
                  <option value="edu.publish_session">
                    {formatMessage({
                      id: "app.admin.actions.create.templateEduPublish",
                      defaultMessage: "Publish Session & Open Roster",
                    })}
                  </option>
                  <option value="edu.deliver_session">
                    {formatMessage({
                      id: "app.admin.actions.create.templateEduDeliver",
                      defaultMessage: "Workshop Delivered",
                    })}
                  </option>
                  <option value="edu.verify_attendance">
                    {formatMessage({
                      id: "app.admin.actions.create.templateEduAttendance",
                      defaultMessage: "Attendance Verified",
                    })}
                  </option>
                  <option value="edu.followup_action">
                    {formatMessage({
                      id: "app.admin.actions.create.templateEduFollowup",
                      defaultMessage: "Follow-up Action Logged",
                    })}
                  </option>
                  <option value="edu.learning_assessment">
                    {formatMessage({
                      id: "app.admin.actions.create.templateEduAssessment",
                      defaultMessage: "Learning Assessment",
                    })}
                  </option>
                </optgroup>
                <optgroup
                  label={formatMessage({
                    id: "app.admin.actions.create.templateGroupWaste",
                    defaultMessage: "Waste Management",
                  })}
                >
                  <option value="waste.site_assessment">
                    {formatMessage({
                      id: "app.admin.actions.create.templateWasteAssessment",
                      defaultMessage: "Site Assessment (Before)",
                    })}
                  </option>
                  <option value="waste.cleanup_event">
                    {formatMessage({
                      id: "app.admin.actions.create.templateWasteCleanup",
                      defaultMessage: "Cleanup Event",
                    })}
                  </option>
                  <option value="waste.sorting_breakdown">
                    {formatMessage({
                      id: "app.admin.actions.create.templateWasteSorting",
                      defaultMessage: "Sorting & Breakdown",
                    })}
                  </option>
                  <option value="waste.transfer_receipt">
                    {formatMessage({
                      id: "app.admin.actions.create.templateWasteTransfer",
                      defaultMessage: "Recycler/Disposal Transfer",
                    })}
                  </option>
                  <option value="waste.upcycle_batch">
                    {formatMessage({
                      id: "app.admin.actions.create.templateWasteUpcycle",
                      defaultMessage: "Compost/Upcycle Batch",
                    })}
                  </option>
                  <option value="waste.maintenance_check">
                    {formatMessage({
                      id: "app.admin.actions.create.templateWasteMaintenance",
                      defaultMessage: "Recurring Maintenance Check",
                    })}
                  </option>
                </optgroup>
              </select>
            </div>
            <InstructionsBuilder
              value={form.watch("instructionConfig")}
              onChange={(config) => form.setValue("instructionConfig", config)}
            />
          </div>
        );

      case 3: {
        const data = form.getValues();
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-text-strong">
                {formatMessage({
                  id: "app.admin.actions.create.reviewTitle",
                  defaultMessage: "Title",
                })}
              </h3>
              <p className="text-text-sub">{data.title}</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-strong">
                {formatMessage({
                  id: "app.admin.actions.create.reviewTimeline",
                  defaultMessage: "Timeline",
                })}
              </h3>
              <p className="text-text-sub">
                {data.startTime.toLocaleDateString()} - {data.endTime.toLocaleDateString()}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-strong">
                {formatMessage({
                  id: "app.admin.actions.create.reviewCapitals",
                  defaultMessage: "Capitals",
                })}
              </h3>
              <p className="text-text-sub">
                {formatMessage(
                  {
                    id: "app.admin.actions.create.reviewCapitalsCount",
                    defaultMessage: "{count} selected",
                  },
                  { count: data.capitals.length }
                )}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-strong">
                {formatMessage({
                  id: "app.admin.actions.create.reviewMedia",
                  defaultMessage: "Media",
                })}
              </h3>
              <p className="text-text-sub">
                {formatMessage(
                  {
                    id: "app.admin.actions.create.reviewMediaCount",
                    defaultMessage: "{count} files",
                  },
                  { count: data.media.length }
                )}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-strong">
                {formatMessage({
                  id: "app.admin.actions.create.reviewFormInputs",
                  defaultMessage: "Form Inputs",
                })}
              </h3>
              <p className="text-text-sub">
                {formatMessage(
                  {
                    id: "app.admin.actions.create.reviewFieldsCount",
                    defaultMessage: "{count} custom fields",
                  },
                  { count: data.instructionConfig.uiConfig.details.inputs.length }
                )}
              </p>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Fields to validate per wizard step before advancing
  const stepFields: Record<number, (keyof CreateActionFormData)[]> = {
    0: ["title", "startTime", "endTime"],
    1: ["capitals"],
  };

  const handleNext = async () => {
    const fields = stepFields[currentStep];
    if (fields) {
      const valid = await form.trigger(fields, { shouldFocus: true });
      if (!valid) return;
    }
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
