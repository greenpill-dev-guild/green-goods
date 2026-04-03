import type { CreateActionFormData } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { FormField } from "@/components/ui/FormField";

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
      <FormField
        label={formatMessage({
          id: "app.admin.actions.create.titleLabel",
          defaultMessage: "Title",
        })}
        htmlFor="create-action-title"
        error={form.formState.errors.title?.message}
      >
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
      </FormField>

      <FormField
        label={formatMessage({
          id: "app.admin.actions.create.slugLabel",
          defaultMessage: "Slug",
        })}
        htmlFor="create-action-slug"
        hint={formatMessage({
          id: "app.admin.actions.create.slugHint",
          defaultMessage: "Format: domain.action_name (lowercase).",
        })}
        error={form.formState.errors.slug?.message}
      >
        <input
          id="create-action-slug"
          {...form.register("slug")}
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          placeholder={formatMessage({
            id: "app.admin.actions.create.slugPlaceholder",
            defaultMessage: "e.g., waste.repair_event",
          })}
        />
      </FormField>

      <FormField
        label={formatMessage({
          id: "app.admin.actions.create.domainLabel",
          defaultMessage: "Domain",
        })}
        htmlFor="create-action-domain"
        error={form.formState.errors.domain?.message}
      >
        <select
          id="create-action-domain"
          {...form.register("domain", { valueAsNumber: true })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
        >
          {domainOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label={formatMessage({
          id: "app.admin.actions.create.startDateLabel",
          defaultMessage: "Start Date",
        })}
        htmlFor="create-action-starttime"
        error={form.formState.errors.startTime?.message}
      >
        <input
          id="create-action-starttime"
          {...form.register("startTime", { valueAsDate: true })}
          type="date"
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
        />
      </FormField>

      <FormField
        label={formatMessage({
          id: "app.admin.actions.create.endDateLabel",
          defaultMessage: "End Date",
        })}
        htmlFor="create-action-endtime"
        error={form.formState.errors.endTime?.message}
      >
        <input
          id="create-action-endtime"
          {...form.register("endTime", { valueAsDate: true })}
          type="date"
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
        />
      </FormField>
    </div>
  );
}
