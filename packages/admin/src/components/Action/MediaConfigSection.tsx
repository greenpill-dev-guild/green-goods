import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { useState } from "react";

interface MediaConfigSectionProps {
  config: ActionInstructionConfig["uiConfig"]["media"];
  onChange: (config: ActionInstructionConfig["uiConfig"]["media"]) => void;
}

export function MediaConfigSection({ config, onChange }: MediaConfigSectionProps) {
  const [newNeeded, setNewNeeded] = useState("");
  const [newOptional, setNewOptional] = useState("");

  const addNeeded = () => {
    if (newNeeded.trim()) {
      onChange({
        ...config,
        needed: [...config.needed, newNeeded.trim()],
      });
      setNewNeeded("");
    }
  };

  const removeNeeded = (index: number) => {
    onChange({
      ...config,
      needed: config.needed.filter((_, i) => i !== index),
    });
  };

  const addOptional = () => {
    if (newOptional.trim()) {
      onChange({
        ...config,
        optional: [...config.optional, newOptional.trim()],
      });
      setNewOptional("");
    }
  };

  const removeOptional = (index: number) => {
    onChange({
      ...config,
      optional: config.optional.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <div>
        <label htmlFor="media-title" className="block text-sm font-medium text-text-strong mb-2">
          Section Title
        </label>
        <input
          id="media-title"
          type="text"
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          placeholder="e.g., Capture Media"
        />
      </div>

      <div>
        <label
          htmlFor="media-description"
          className="block text-sm font-medium text-text-strong mb-2"
        >
          Description
        </label>
        <textarea
          id="media-description"
          value={config.description}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          rows={3}
          placeholder="Provide instructions for media capture..."
        />
      </div>

      {/* Image Count */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="media-min" className="block text-sm font-medium text-text-strong mb-2">
            Min Images
          </label>
          <input
            id="media-min"
            type="number"
            min="0"
            value={config.minImageCount}
            onChange={(e) => onChange({ ...config, minImageCount: parseInt(e.target.value) || 0 })}
            className="w-full rounded-md border border-stroke-soft px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="media-max" className="block text-sm font-medium text-text-strong mb-2">
            Max Images
          </label>
          <input
            id="media-max"
            type="number"
            min="1"
            value={config.maxImageCount}
            onChange={(e) => onChange({ ...config, maxImageCount: parseInt(e.target.value) || 1 })}
            className="w-full rounded-md border border-stroke-soft px-3 py-2"
          />
        </div>
      </div>

      {/* Required Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="media-required"
          checked={config.required}
          onChange={(e) => onChange({ ...config, required: e.target.checked })}
          className="rounded border-stroke-soft"
        />
        <label htmlFor="media-required" className="text-sm text-text-strong">
          Media is required
        </label>
      </div>

      {/* Needed Shot Types */}
      <div>
        <label htmlFor="media-needed" className="block text-sm font-medium text-text-strong mb-2">
          Required Shot Types
        </label>
        <p className="text-xs text-text-sub mb-3">
          Specify what types of photos users must capture
        </p>
        <fieldset id="media-needed" className="space-y-2">
          {config.needed.map((shot, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={shot}
                onChange={(e) => {
                  const updated = [...config.needed];
                  updated[index] = e.target.value;
                  onChange({ ...config, needed: updated });
                }}
                className="flex-1 rounded-md border border-stroke-soft px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeNeeded(index)}
                className="p-2 text-error-base hover:bg-error-lighter rounded"
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newNeeded}
              onChange={(e) => setNewNeeded(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNeeded();
                }
              }}
              placeholder="e.g., Front view, Side view"
              className="flex-1 rounded-md border border-stroke-soft px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addNeeded}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-1"
            >
              <RiAddLine className="h-4 w-4" />
              Add
            </button>
          </div>
        </fieldset>
      </div>

      {/* Optional Shot Types */}
      <div>
        <label htmlFor="media-optional" className="block text-sm font-medium text-text-strong mb-2">
          Optional Shot Types
        </label>
        <p className="text-xs text-text-sub mb-3">
          Suggest additional photos users can optionally include
        </p>
        <fieldset id="media-optional" className="space-y-2">
          {config.optional.map((shot, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={shot}
                onChange={(e) => {
                  const updated = [...config.optional];
                  updated[index] = e.target.value;
                  onChange({ ...config, optional: updated });
                }}
                className="flex-1 rounded-md border border-stroke-soft px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeOptional(index)}
                className="p-2 text-error-base hover:bg-error-lighter rounded"
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newOptional}
              onChange={(e) => setNewOptional(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOptional();
                }
              }}
              placeholder="e.g., Close-up, Detail shot"
              className="flex-1 rounded-md border border-stroke-soft px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addOptional}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-1"
            >
              <RiAddLine className="h-4 w-4" />
              Add
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
