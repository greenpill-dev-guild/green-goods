import { type CreateActionFormData, cn } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { FileUploadField } from "@/components/FileUploadField";
import { FormField } from "@/components/ui/FormField";

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
