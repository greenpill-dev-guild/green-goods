import type { CreateActionFormData } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";

interface ReviewStepProps {
  form: UseFormReturn<CreateActionFormData>;
}

export function ReviewStep({ form }: ReviewStepProps): React.ReactElement {
  const { formatMessage } = useIntl();
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
