import { useState } from "react";
import { DetailsConfigSection } from "./DetailsConfigSection";
import { MediaConfigSection } from "./MediaConfigSection";
import { ReviewConfigSection } from "./ReviewConfigSection";

interface InstructionsBuilderProps {
  value: ActionInstructionConfig;
  onChange: (config: ActionInstructionConfig) => void;
}

type UIConfigKey = keyof ActionInstructionConfig["uiConfig"];

export function InstructionsBuilder({ value, onChange }: InstructionsBuilderProps) {
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
              ? "border-b-2 border-green-500 text-green-600"
              : "text-text-sub hover:text-text-strong"
          }`}
        >
          Media Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "details"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-text-sub hover:text-text-strong"
          }`}
        >
          Form Inputs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "review"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-text-sub hover:text-text-strong"
          }`}
        >
          Review Screen
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
            JSON Preview
          </summary>
          <pre className="text-xs bg-bg-white p-3 rounded border border-stroke-soft overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
