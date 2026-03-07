import type { CreateActionFormData } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";

interface BasicsStepProps {
  form: UseFormReturn<CreateActionFormData>;
}

export function BasicsStep({ form }: BasicsStepProps): React.ReactElement {
  const { formatMessage } = useIntl();

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
          <p className="text-error-base text-sm mt-1">{form.formState.errors.title.message}</p>
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
          <p className="text-error-base text-sm mt-1">{form.formState.errors.startTime.message}</p>
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
          <p className="text-error-base text-sm mt-1">{form.formState.errors.endTime.message}</p>
        )}
      </div>
    </div>
  );
}
