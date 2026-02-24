import type { ActionInstructionConfig } from "@green-goods/shared";
import { useIntl } from "react-intl";

interface ReviewConfigSectionProps {
  config: ActionInstructionConfig["uiConfig"]["review"];
  onChange: (config: ActionInstructionConfig["uiConfig"]["review"]) => void;
}

export function ReviewConfigSection({ config, onChange }: ReviewConfigSectionProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="review-title" className="block text-sm font-medium text-text-strong mb-2">
          {formatMessage({
            id: "app.admin.actions.reviewConfig.sectionTitle",
            defaultMessage: "Section Title",
          })}
        </label>
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
      </div>

      <div>
        <label
          htmlFor="review-description"
          className="block text-sm font-medium text-text-strong mb-2"
        >
          {formatMessage({
            id: "app.admin.actions.reviewConfig.description",
            defaultMessage: "Description",
          })}
        </label>
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
      </div>
    </div>
  );
}
