interface ReviewConfigSectionProps {
  config: ActionInstructionConfig["uiConfig"]["review"];
  onChange: (config: ActionInstructionConfig["uiConfig"]["review"]) => void;
}

export function ReviewConfigSection({ config, onChange }: ReviewConfigSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-strong mb-2">Section Title</label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          placeholder="e.g., Review & Submit"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-strong mb-2">Description</label>
        <textarea
          value={config.description}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          rows={3}
          placeholder="Instructions for the review screen..."
        />
      </div>
    </div>
  );
}
