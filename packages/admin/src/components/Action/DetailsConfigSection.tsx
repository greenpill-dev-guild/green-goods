import {
  type ActionInstructionConfig,
  FormField,
  NativeSelect,
  Textarea,
  TextInput,
  type WorkInput,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiCloseLine,
  RiDeleteBinLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "../AdminButton";
import { AdminCheckbox } from "../AdminCheckbox";

interface DetailsConfigSectionProps {
  config: ActionInstructionConfig["uiConfig"]["details"];
  onChange: (config: ActionInstructionConfig["uiConfig"]["details"]) => void;
}

export function DetailsConfigSection({ config, onChange }: DetailsConfigSectionProps) {
  const { formatMessage } = useIntl();

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
      <FormField
        label={formatMessage({
          id: "app.admin.actions.detailsConfig.sectionTitle",
          defaultMessage: "Section Title",
        })}
        htmlFor="section-title"
      >
        <TextInput
          id="section-title"
          surface="admin"
          type="text"
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          placeholder={formatMessage({
            id: "app.admin.actions.detailsConfig.sectionTitlePlaceholder",
            defaultMessage: "e.g., Enter Details",
          })}
        />
      </FormField>

      <FormField
        label={formatMessage({
          id: "app.admin.actions.detailsConfig.description",
          defaultMessage: "Description",
        })}
        htmlFor="section-description"
      >
        <Textarea
          id="section-description"
          surface="admin"
          value={config.description}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          rows={2}
          placeholder={formatMessage({
            id: "app.admin.actions.detailsConfig.descriptionPlaceholder",
            defaultMessage: "Instructions for this section...",
          })}
        />
      </FormField>

      <FormField
        label={formatMessage({
          id: "app.admin.actions.detailsConfig.feedbackPlaceholder",
          defaultMessage: "Feedback Placeholder",
        })}
        htmlFor="feedback-placeholder"
      >
        <TextInput
          id="feedback-placeholder"
          surface="admin"
          type="text"
          value={config.feedbackPlaceholder}
          onChange={(e) => onChange({ ...config, feedbackPlaceholder: e.target.value })}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
          placeholder={formatMessage({
            id: "app.admin.actions.detailsConfig.feedbackPlaceholderPlaceholder",
            defaultMessage: "e.g., Provide feedback or observations...",
          })}
        />
      </FormField>

      {/* Dynamic Form Inputs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-strong">
            {formatMessage({
              id: "app.admin.actions.detailsConfig.formInputs",
              defaultMessage: "Form Inputs",
            })}
          </h3>
          <AdminButton type="button" size="sm" onClick={addInput} leadingIcon={<RiAddLine />}>
            {formatMessage({
              id: "app.admin.actions.detailsConfig.addInput",
              defaultMessage: "Add Input",
            })}
          </AdminButton>
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
              <p className="text-text-sub mb-2">
                {formatMessage({
                  id: "app.admin.actions.detailsConfig.noInputs",
                  defaultMessage: "No form inputs yet",
                })}
              </p>
              <AdminButton
                type="button"
                variant="text"
                size="sm"
                onClick={addInput}
                className="h-auto min-w-0 text-sm"
              >
                {formatMessage({
                  id: "app.admin.actions.detailsConfig.addFirstInput",
                  defaultMessage: "Add your first input field",
                })}
              </AdminButton>
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
  const { formatMessage } = useIntl();
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
          <span className="text-sm font-medium text-text-strong">
            {formatMessage(
              {
                id: "app.admin.actions.detailsConfig.inputNumber",
                defaultMessage: "Input #{number}",
              },
              { number: index + 1 }
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <AdminButton
            type="button"
            variant="text"
            size="sm"
            onClick={() => onMove("up")}
            disabled={index === 0}
            className="h-8 w-8 min-w-0 px-0 text-text-soft hover:text-text-strong disabled:opacity-30"
            title={formatMessage({
              id: "app.admin.actions.detailsConfig.moveUp",
              defaultMessage: "Move up",
            })}
          >
            <RiArrowUpLine className="h-4 w-4" />
          </AdminButton>
          <AdminButton
            type="button"
            variant="text"
            size="sm"
            onClick={() => onMove("down")}
            disabled={index === totalInputs - 1}
            className="h-8 w-8 min-w-0 px-0 text-text-soft hover:text-text-strong disabled:opacity-30"
            title={formatMessage({
              id: "app.admin.actions.detailsConfig.moveDown",
              defaultMessage: "Move down",
            })}
          >
            <RiArrowDownLine className="h-4 w-4" />
          </AdminButton>
          <AdminButton
            type="button"
            variant="text"
            size="sm"
            onClick={onRemove}
            className="ml-2 h-8 w-8 min-w-0 px-0 text-error-base hover:bg-error-lighter"
            title={formatMessage({
              id: "app.admin.actions.detailsConfig.delete",
              defaultMessage: "Delete",
            })}
          >
            <RiDeleteBinLine className="h-4 w-4" />
          </AdminButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.fieldKey",
            defaultMessage: "Field Key",
          })}
          htmlFor={`field-key-${input.key}`}
        >
          <TextInput
            id={`field-key-${input.key}`}
            surface="admin"
            type="text"
            value={input.key}
            onChange={(e) => onUpdate({ key: e.target.value })}
            className="w-full rounded-md border border-stroke-soft px-2 py-1.5 text-sm"
            placeholder={formatMessage({
              id: "app.admin.actions.detailsConfig.fieldKeyPlaceholder",
              defaultMessage: "e.g., plantCount",
            })}
          />
        </FormField>

        <FormField
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.fieldType",
            defaultMessage: "Field Type",
          })}
          htmlFor={`field-type-${input.key}`}
        >
          <NativeSelect
            id={`field-type-${input.key}`}
            surface="admin"
            value={input.type}
            onChange={(e) => onUpdate({ type: e.target.value as WorkInput["type"], options: [] })}
            className="w-full rounded-md border border-stroke-soft px-2 py-1.5 text-sm"
          >
            <option value="text">
              {formatMessage({
                id: "app.admin.actions.detailsConfig.typeText",
                defaultMessage: "Text",
              })}
            </option>
            <option value="textarea">
              {formatMessage({
                id: "app.admin.actions.detailsConfig.typeTextArea",
                defaultMessage: "Text Area",
              })}
            </option>
            <option value="number">
              {formatMessage({
                id: "app.admin.actions.detailsConfig.typeNumber",
                defaultMessage: "Number",
              })}
            </option>
            <option value="select">
              {formatMessage({
                id: "app.admin.actions.detailsConfig.typeSelect",
                defaultMessage: "Select Dropdown",
              })}
            </option>
            <option value="multi-select">
              {formatMessage({
                id: "app.admin.actions.detailsConfig.typeMultiSelect",
                defaultMessage: "Multi-select",
              })}
            </option>
          </NativeSelect>
        </FormField>

        <FormField
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.label",
            defaultMessage: "Label",
          })}
          htmlFor={`field-label-${input.key}`}
        >
          <TextInput
            id={`field-label-${input.key}`}
            surface="admin"
            type="text"
            value={input.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full rounded-md border border-stroke-soft px-2 py-1.5 text-sm"
            placeholder={formatMessage({
              id: "app.admin.actions.detailsConfig.labelPlaceholder",
              defaultMessage: "e.g., Number of Plants",
            })}
          />
        </FormField>

        <FormField
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.placeholder",
            defaultMessage: "Placeholder",
          })}
          htmlFor={`field-placeholder-${input.key}`}
        >
          <TextInput
            id={`field-placeholder-${input.key}`}
            surface="admin"
            type="text"
            value={input.placeholder}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            className="w-full rounded-md border border-stroke-soft px-2 py-1.5 text-sm"
            placeholder={formatMessage({
              id: "app.admin.actions.detailsConfig.placeholderPlaceholder",
              defaultMessage: "e.g., Enter count",
            })}
          />
        </FormField>
      </div>

      <div className="mt-3">
        <AdminCheckbox
          id={`required-${input.key}`}
          checked={input.required}
          onChange={(e) => onUpdate({ required: e.target.checked })}
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.requiredField",
            defaultMessage: "Required field",
          })}
        />
      </div>

      {/* Options for Select type */}
      {(input.type === "select" || input.type === "multi-select") && (
        <div className="mt-3 pt-3 border-t border-stroke-soft">
          <FormField
            label={formatMessage({
              id: "app.admin.actions.detailsConfig.options",
              defaultMessage: "Options",
            })}
          >
            <div id={`field-options-${input.key}`} className="space-y-1.5">
              {input.options.map((option, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <TextInput
                    surface="admin"
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const updated = [...input.options];
                      updated[optIndex] = e.target.value;
                      onUpdate({ options: updated });
                    }}
                    className="flex-1 rounded-md border border-stroke-soft px-2 py-1 text-sm"
                  />
                  <AdminButton
                    type="button"
                    variant="text"
                    size="sm"
                    onClick={() => removeOption(optIndex)}
                    className="h-8 w-8 min-w-0 px-0 text-error-base hover:bg-error-lighter"
                  >
                    <RiCloseLine className="h-4 w-4" />
                  </AdminButton>
                </div>
              ))}
              <div className="flex gap-2">
                <TextInput
                  surface="admin"
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder={formatMessage({
                    id: "app.admin.actions.detailsConfig.addOptionPlaceholder",
                    defaultMessage: "Add option...",
                  })}
                  className="flex-1 rounded-md border border-stroke-soft px-2 py-1 text-sm"
                />
                <AdminButton
                  type="button"
                  size="sm"
                  onClick={addOption}
                  className="h-8 w-8 px-0"
                  aria-label={formatMessage({
                    id: "app.admin.actions.detailsConfig.addOptionPlaceholder",
                    defaultMessage: "Add option...",
                  })}
                >
                  <RiAddLine className="h-3.5 w-3.5" />
                </AdminButton>
              </div>
            </div>
          </FormField>
        </div>
      )}
    </div>
  );
}
