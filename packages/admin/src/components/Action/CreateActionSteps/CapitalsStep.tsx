import { FileUploadField } from "@green-goods/shared/components/FileUploadField";
import type { CreateActionFormData } from "@green-goods/shared/hooks/action/useActionForm";
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminCheckbox } from "../../AdminCheckbox";
import { AdminFieldGroup } from "../../AdminFieldGroup";

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
      <AdminFieldGroup
        id="create-action-capitals"
        label={formatMessage({
          id: "app.admin.actions.create.capitalsLabel",
          defaultMessage: "Forms of capital",
        })}
        required
        hint={formatMessage({
          id: "app.admin.actions.create.capitalsDescription",
          defaultMessage: "Select the forms of capital associated with this action",
        })}
        error={form.formState.errors.capitals?.message}
        contentClassName="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
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
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 transition",
                "[&>span:first-child]:h-5 [&>span:first-child]:w-5",
                "[&>span:nth-child(2)]:min-w-0 [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:pt-0",
                "[&>span:nth-child(2)>span]:truncate [&>span:nth-child(2)>span]:label-md [&>span:nth-child(2)>span]:font-medium",
                isChecked
                  ? "border-success-base bg-success-lighter text-success-dark"
                  : "border-stroke-soft bg-bg-white text-text-sub hover:border-success-light hover:bg-success-lighter/30"
              )}
            />
          );
        })}
      </AdminFieldGroup>

      <AdminFieldGroup
        as="div"
        label={formatMessage({
          id: "app.admin.actions.create.mediaLabel",
          defaultMessage: "Media (images)",
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
      </AdminFieldGroup>
    </div>
  );
}
