import type { ActionInstructionConfig } from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { DetailsConfigSection } from "./DetailsConfigSection";
import { MediaConfigSection } from "./MediaConfigSection";
import { ReviewConfigSection } from "./ReviewConfigSection";

interface InstructionsBuilderProps {
  value: ActionInstructionConfig;
  onChange: (config: ActionInstructionConfig) => void;
}

type UIConfigKey = keyof ActionInstructionConfig["uiConfig"];

export function InstructionsBuilder({ value, onChange }: InstructionsBuilderProps) {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState<"media" | "details" | "review">("media");

  const updateUIConfig = <K extends UIConfigKey>(
    key: K,
    newValue: ActionInstructionConfig["uiConfig"][K]
  ) => {
    onChange({
      ...value,
      uiConfig: {
        ...value.uiConfig,
        [key]: newValue,
      },
    });
  };

  return (
    <div className="border border-stroke-soft rounded-lg bg-bg-white">
      {/* Tab Navigation */}
      <div className="flex border-b border-stroke-soft">
        <button
          type="button"
          onClick={() => setActiveTab("media")}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "media"
              ? "border-b-2 border-primary-base text-primary-base"
              : "text-text-sub hover:text-text-strong"
          }`}
        >
          {formatMessage({ id: "app.admin.actions.instructions.tabMedia", defaultMessage: "Media Configuration" })}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "details"
              ? "border-b-2 border-primary-base text-primary-base"
              : "text-text-sub hover:text-text-strong"
          }`}
        >
          {formatMessage({ id: "app.admin.actions.instructions.tabFormInputs", defaultMessage: "Form Inputs" })}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "review"
              ? "border-b-2 border-primary-base text-primary-base"
              : "text-text-sub hover:text-text-strong"
          }`}
        >
          {formatMessage({ id: "app.admin.actions.instructions.tabReview", defaultMessage: "Review Screen" })}
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "media" && (
          <MediaConfigSection
            config={value.uiConfig.media}
            onChange={(media) => updateUIConfig("media", media)}
          />
        )}

        {activeTab === "details" && (
          <DetailsConfigSection
            config={value.uiConfig.details}
            onChange={(details) => updateUIConfig("details", details)}
          />
        )}

        {activeTab === "review" && (
          <ReviewConfigSection
            config={value.uiConfig.review}
            onChange={(review) => updateUIConfig("review", review)}
          />
        )}
      </div>

      {/* JSON Preview */}
      <div className="border-t border-stroke-soft p-4 bg-bg-soft">
        <details>
          <summary className="text-sm font-medium text-text-strong cursor-pointer mb-2">
            {formatMessage({ id: "app.admin.actions.instructions.jsonPreview", defaultMessage: "JSON Preview" })}
          </summary>
          <pre className="text-xs bg-bg-white p-3 rounded border border-stroke-soft overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
