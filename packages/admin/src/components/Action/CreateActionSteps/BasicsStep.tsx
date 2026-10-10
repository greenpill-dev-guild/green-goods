import type { CreateActionFormData } from "@green-goods/shared/hooks/action/useActionForm";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminSelect, AdminTextField } from "../../AdminTextField";

interface DomainOption {
  value: number;
  label: string;
}

interface BasicsStepProps {
  form: UseFormReturn<CreateActionFormData>;
  domainOptions: DomainOption[];
}

export function BasicsStep({ form, domainOptions }: BasicsStepProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <AdminTextField
        id="create-action-title"
        label={formatMessage({
          id: "app.admin.actions.create.titleLabel",
          defaultMessage: "Title",
        })}
        error={form.formState.errors.title?.message}
        {...form.register("title")}
        placeholder={formatMessage({
          id: "app.admin.actions.create.titlePlaceholder",
          defaultMessage: "Action title",
        })}
      />

      <AdminTextField
        id="create-action-slug"
        label={formatMessage({
          id: "app.admin.actions.create.slugLabel",
          defaultMessage: "Slug",
        })}
        helperText={formatMessage({
          id: "app.admin.actions.create.slugHint",
          defaultMessage: "Format: domain.action_name (lowercase).",
        })}
        error={form.formState.errors.slug?.message}
        {...form.register("slug")}
        inputProps={{ autoCapitalize: "none", autoCorrect: "off", spellCheck: false }}
        placeholder={formatMessage({
          id: "app.admin.actions.create.slugPlaceholder",
          defaultMessage: "e.g., waste.repair_event",
        })}
      />

      <AdminSelect
        id="create-action-domain"
        label={formatMessage({
          id: "app.admin.actions.create.domainLabel",
          defaultMessage: "Domain",
        })}
        error={form.formState.errors.domain?.message}
        {...form.register("domain", { valueAsNumber: true })}
      >
        {domainOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </AdminSelect>

      <AdminTextField
        id="create-action-starttime"
        type="date"
        label={formatMessage({
          id: "app.admin.actions.create.startDateLabel",
          defaultMessage: "Start date",
        })}
        error={form.formState.errors.startTime?.message}
        {...form.register("startTime", { valueAsDate: true })}
      />

      <AdminTextField
        id="create-action-endtime"
        type="date"
        label={formatMessage({
          id: "app.admin.actions.create.endDateLabel",
          defaultMessage: "End date",
        })}
        error={form.formState.errors.endTime?.message}
        {...form.register("endTime", { valueAsDate: true })}
      />
    </div>
  );
}
