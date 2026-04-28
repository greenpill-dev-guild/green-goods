import { type CreateActionFormData, cn, FileUploadField, FormField } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminCheckbox } from "../../AdminCheckbox";

interface CapitalsStepProps {
  form: UseFormReturn<CreateActionFormData>;
}

export function CapitalsStep({ form }: CapitalsStepProps) {
  const { formatMessage } = useIntl();
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
      <FormField
        label={formatMessage({
          id: "app.admin.actions.create.capitalsLabel",
          defaultMessage: "Forms of Capital",
        })}
        required
        hint={formatMessage({
          id: "app.admin.actions.create.capitalsDescription",
          defaultMessage: "Select the forms of capital associated with this action",
        })}
        error={form.formState.errors.capitals?.message}
      >
        <fieldset id="create-action-capitals" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CAPITALS_OPTIONS.map((capital) => {
            const isChecked = capitals.includes(capital.value);
            return (
              <AdminCheckbox
                key={capital.value}
                checked={isChecked}
                onChange={(e) => {
                  const newCapitals = e.target.checked
                    ? [...capitals, capital.value]
                    : capitals.filter((c) => c !== capital.value);
                  form.setValue("capitals", newCapitals);
                }}
                label={capital.label}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition",
                  "[&>span:first-child]:h-5 [&>span:first-child]:w-5",
                  "[&>span:nth-child(2)]:min-w-0 [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:pt-0",
                  "[&>span:nth-child(2)>span]:truncate [&>span:nth-child(2)>span]:text-sm [&>span:nth-child(2)>span]:font-medium",
                  isChecked
                    ? "border-success-base bg-success-lighter text-success-dark"
                    : "border-stroke-soft bg-bg-white text-text-sub hover:border-success-light hover:bg-success-lighter/30"
                )}
              />
            );
          })}
        </fieldset>
      </FormField>

      <FormField
        label={formatMessage({
          id: "app.admin.actions.create.mediaLabel",
          defaultMessage: "Media (Images)",
        })}
        error={form.formState.errors.media?.message}
      >
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
      </FormField>
    </div>
  );
}
