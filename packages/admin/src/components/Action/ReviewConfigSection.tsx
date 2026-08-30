import type { ActionInstructionConfig } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { AdminTextArea, AdminTextField } from "../AdminTextField";

interface ReviewConfigSectionProps {
  config: ActionInstructionConfig["uiConfig"]["review"];
  onChange: (config: ActionInstructionConfig["uiConfig"]["review"]) => void;
}

export function ReviewConfigSection({ config, onChange }: ReviewConfigSectionProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <AdminTextField
        id="review-title"
        label={formatMessage({
          id: "app.admin.actions.reviewConfig.sectionTitle",
          defaultMessage: "Section title",
        })}
        value={config.title}
        onChange={(e) => onChange({ ...config, title: e.target.value })}
        placeholder={formatMessage({
          id: "app.admin.actions.reviewConfig.sectionTitlePlaceholder",
          defaultMessage: "e.g., Review & Submit",
        })}
      />

      <AdminTextArea
        id="review-description"
        label={formatMessage({
          id: "app.admin.actions.reviewConfig.description",
          defaultMessage: "Description",
        })}
        value={config.description}
        onChange={(e) => onChange({ ...config, description: e.target.value })}
        rows={3}
        placeholder={formatMessage({
          id: "app.admin.actions.reviewConfig.descriptionPlaceholder",
          defaultMessage: "Instructions for the review screen...",
        })}
      />
    </div>
  );
}
