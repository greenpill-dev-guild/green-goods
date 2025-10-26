import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiDraggable,
} from "@remixicon/react";
import { useState } from "react";

interface DetailsConfigSectionProps {
  config: ActionInstructionConfig["uiConfig"]["details"];
  onChange: (config: ActionInstructionConfig["uiConfig"]["details"]) => void;
}

export function DetailsConfigSection({ config, onChange }: DetailsConfigSectionProps) {
  const addInput = () => {
    const newInput: WorkInput = {
      key: `field_${Date.now()}`,
      title: "",
      placeholder: "",
      type: "text",
      required: false,
      options: [],
    };

    onChange({
      ...config,
      inputs: [...config.inputs, newInput],
    });
  };

  const updateInput = (index: number, updates: Partial<WorkInput>) => {
    const updated = [...config.inputs];
    updated[index] = { ...updated[index], ...updates };
    onChange({ ...config, inputs: updated });
  };

  const removeInput = (index: number) => {
    onChange({
      ...config,
      inputs: config.inputs.filter((_, i) => i !== index),
    });
  };

  const moveInput = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= config.inputs.length) return;

    const updated = [...config.inputs];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange({ ...config, inputs: updated });
  };

  return (
    <div className="space-y-6">
      {/* Section Settings */}
      <div>
        <label className="block text-sm font-medium text-text-strong mb-2">Section Title</label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          placeholder="e.g., Enter Details"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-strong mb-2">Description</label>
        <textarea
          value={config.description}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          rows={2}
          placeholder="Instructions for this section..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-strong mb-2">
          Feedback Placeholder
        </label>
        <input
          type="text"
          value={config.feedbackPlaceholder}
          onChange={(e) => onChange({ ...config, feedbackPlaceholder: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          placeholder="e.g., Provide feedback or observations..."
        />
      </div>

      {/* Dynamic Form Inputs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-strong">Form Inputs</h3>
          <button
            type="button"
            onClick={addInput}
            className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-1"
          >
            <RiAddLine className="h-4 w-4" />
            Add Input
          </button>
        </div>

        <div className="space-y-4">
          {config.inputs.map((input, index) => (
            <InputFieldEditor
              key={input.key}
              input={input}
              index={index}
              totalInputs={config.inputs.length}
              onUpdate={(updates) => updateInput(index, updates)}
              onRemove={() => removeInput(index)}
              onMove={(direction) => moveInput(index, direction)}
            />
          ))}

          {config.inputs.length === 0 && (
            <div className="text-center py-8 border border-dashed border-stroke-soft rounded-lg">
              <p className="text-text-sub mb-2">No form inputs yet</p>
              <button
                type="button"
                onClick={addInput}
                className="text-green-600 hover:text-green-700 text-sm"
              >
                Add your first input field
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent for individual input field editing
function InputFieldEditor({
  input,
  index,
  totalInputs,
  onUpdate,
  onRemove,
  onMove,
}: {
  input: WorkInput;
  index: number;
  totalInputs: number;
  onUpdate: (updates: Partial<WorkInput>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const [newOption, setNewOption] = useState("");

  const addOption = () => {
    if (newOption.trim()) {
      onUpdate({ options: [...input.options, newOption.trim()] });
      setNewOption("");
    }
  };

  const removeOption = (optIndex: number) => {
    onUpdate({ options: input.options.filter((_, i) => i !== optIndex) });
  };

  return (
    <div className="border border-stroke-soft rounded-lg p-4 bg-bg-soft">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiDraggable className="h-5 w-5 text-text-soft" />
          <span className="text-sm font-medium text-text-strong">Input #{index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0}
            className="p-1 text-text-soft hover:text-text-strong disabled:opacity-30"
            title="Move up"
          >
            <RiArrowUpLine className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index === totalInputs - 1}
            className="p-1 text-text-soft hover:text-text-strong disabled:opacity-30"
            title="Move down"
          >
            <RiArrowDownLine className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-error-base hover:bg-error-lighter rounded ml-2"
            title="Delete"
          >
            <RiDeleteBinLine className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-sub mb-1">Field Key</label>
          <input
            type="text"
            value={input.key}
            onChange={(e) => onUpdate({ key: e.target.value })}
            className="w-full rounded-md border border-stroke-soft px-2 py-1.5 text-sm"
            placeholder="e.g., plantCount"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-sub mb-1">Field Type</label>
          <select
            value={input.type}
            onChange={(e) => onUpdate({ type: e.target.value as WorkInput["type"], options: [] })}
            className="w-full rounded-md border border-stroke-soft px-2 py-1.5 text-sm"
          >
            <option value="text">Text</option>
            <option value="textarea">Text Area</option>
            <option value="number">Number</option>
            <option value="select">Select Dropdown</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-sub mb-1">Label</label>
          <input
            type="text"
            value={input.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full rounded-md border border-stroke-soft px-2 py-1.5 text-sm"
            placeholder="e.g., Number of Plants"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-sub mb-1">Placeholder</label>
          <input
            type="text"
            value={input.placeholder}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            className="w-full rounded-md border border-stroke-soft px-2 py-1.5 text-sm"
            placeholder="e.g., Enter count"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          id={`required-${input.key}`}
          checked={input.required}
          onChange={(e) => onUpdate({ required: e.target.checked })}
          className="rounded border-stroke-soft"
        />
        <label htmlFor={`required-${input.key}`} className="text-xs text-text-strong">
          Required field
        </label>
      </div>

      {/* Options for Select type */}
      {input.type === "select" && (
        <div className="mt-3 pt-3 border-t border-stroke-soft">
          <label className="block text-xs font-medium text-text-sub mb-2">Options</label>
          <div className="space-y-1.5">
            {input.options.map((option, optIndex) => (
              <div key={optIndex} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const updated = [...input.options];
                    updated[optIndex] = e.target.value;
                    onUpdate({ options: updated });
                  }}
                  className="flex-1 rounded-md border border-stroke-soft px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeOption(optIndex)}
                  className="p-1 text-error-base hover:bg-error-lighter rounded"
                >
                  <RiCloseLine className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOption();
                  }
                }}
                placeholder="Add option..."
                className="flex-1 rounded-md border border-stroke-soft px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={addOption}
                className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs"
              >
                <RiAddLine className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
