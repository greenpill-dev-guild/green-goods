import type { ActionInstructionConfig } from "@green-goods/shared/types/domain";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminTabRail } from "../AdminTabRail";
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
      <AdminTabRail
        className="px-2"
        ariaLabel={formatMessage({
          id: "app.admin.actions.instructions.tabsLabel",
          defaultMessage: "Instruction sections",
        })}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as "media" | "details" | "review")}
        tabs={[
          {
            id: "media",
            label: formatMessage({
              id: "app.admin.actions.instructions.tabMedia",
              defaultMessage: "Media Configuration",
            }),
          },
          {
            id: "details",
            label: formatMessage({
              id: "app.admin.actions.instructions.tabFormInputs",
              defaultMessage: "Form Inputs",
            }),
          },
          {
            id: "review",
            label: formatMessage({
              id: "app.admin.actions.instructions.tabReview",
              defaultMessage: "Review Screen",
            }),
          },
        ]}
      />

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
            {formatMessage({
              id: "app.admin.actions.instructions.jsonPreview",
              defaultMessage: "JSON Preview",
            })}
          </summary>
          <pre className="text-xs bg-bg-white p-3 rounded border border-stroke-soft overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
