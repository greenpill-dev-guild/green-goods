import type { CreateActionFormData } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";

interface DomainOption {
  value: number;
  label: string;
}

interface ReviewStepProps {
  form: UseFormReturn<CreateActionFormData>;
  domainOptions: DomainOption[];
}

export function ReviewStep({ form, domainOptions }: ReviewStepProps) {
  const { formatMessage } = useIntl();
  const data = form.getValues();
  const selectedDomainLabel =
    domainOptions.find((option) => option.value === data.domain)?.label ?? data.domain;

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
            id: "app.admin.actions.create.reviewSlug",
            defaultMessage: "Slug",
          })}
        </h3>
        <p className="text-text-sub">{data.slug}</p>
      </div>
      <div>
        <h3 className="font-semibold text-text-strong">
          {formatMessage({
            id: "app.admin.actions.create.reviewDomain",
            defaultMessage: "Domain",
          })}
        </h3>
        <p className="text-text-sub">{selectedDomainLabel}</p>
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
