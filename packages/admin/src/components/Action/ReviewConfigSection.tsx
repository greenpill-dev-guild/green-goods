import type { ActionInstructionConfig } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { FormField } from "@/components/ui/FormField";

interface ReviewConfigSectionProps {
  config: ActionInstructionConfig["uiConfig"]["review"];
  onChange: (config: ActionInstructionConfig["uiConfig"]["review"]) => void;
}

export function ReviewConfigSection({ config, onChange }: ReviewConfigSectionProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <FormField
        label={formatMessage({
          id: "app.admin.actions.reviewConfig.sectionTitle",
          defaultMessage: "Section Title",
        })}
        htmlFor="review-title"
      >
        <input
          id="review-title"
          type="text"
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          placeholder={formatMessage({
            id: "app.admin.actions.reviewConfig.sectionTitlePlaceholder",
            defaultMessage: "e.g., Review & Submit",
          })}
        />
      </FormField>

      <FormField
        label={formatMessage({
          id: "app.admin.actions.reviewConfig.description",
          defaultMessage: "Description",
        })}
        htmlFor="review-description"
      >
        <textarea
          id="review-description"
          value={config.description}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          rows={3}
          placeholder={formatMessage({
            id: "app.admin.actions.reviewConfig.descriptionPlaceholder",
            defaultMessage: "Instructions for the review screen...",
          })}
        />
      </FormField>
    </div>
  );
}
