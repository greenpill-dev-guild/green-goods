import type { ActionInstructionConfig, WorkInput } from "@green-goods/shared/types/domain";
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiCloseLine,
  RiDeleteBinLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton, AdminIconButton } from "../AdminButton";
import { AdminCheckbox } from "../AdminCheckbox";
import { AdminFieldGroup } from "../AdminFieldGroup";
import { AdminSelect, AdminTextArea, AdminTextField } from "../AdminTextField";

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
      <AdminTextField
        id="section-title"
        label={formatMessage({
          id: "app.admin.actions.detailsConfig.sectionTitle",
          defaultMessage: "Section title",
        })}
        value={config.title}
        onChange={(e) => onChange({ ...config, title: e.target.value })}
        placeholder={formatMessage({
          id: "app.admin.actions.detailsConfig.sectionTitlePlaceholder",
          defaultMessage: "e.g., Enter Details",
        })}
      />

      <AdminTextArea
        id="section-description"
        label={formatMessage({
          id: "app.admin.actions.detailsConfig.description",
          defaultMessage: "Description",
        })}
        value={config.description}
        onChange={(e) => onChange({ ...config, description: e.target.value })}
        rows={2}
        placeholder={formatMessage({
          id: "app.admin.actions.detailsConfig.descriptionPlaceholder",
          defaultMessage: "Instructions for this section...",
        })}
      />

      <AdminTextField
        id="feedback-placeholder"
        label={formatMessage({
          id: "app.admin.actions.detailsConfig.feedbackPlaceholder",
          defaultMessage: "Feedback placeholder",
        })}
        value={config.feedbackPlaceholder}
        onChange={(e) => onChange({ ...config, feedbackPlaceholder: e.target.value })}
        placeholder={formatMessage({
          id: "app.admin.actions.detailsConfig.feedbackPlaceholderPlaceholder",
          defaultMessage: "e.g., Provide feedback or observations...",
        })}
      />

      {/* Dynamic Form Inputs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="label-lg font-semibold text-text-strong">
            {formatMessage({
              id: "app.admin.actions.detailsConfig.formInputs",
              defaultMessage: "Form inputs",
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
              <p className="body-md text-text-sub mb-2">
                {formatMessage({
                  id: "app.admin.actions.detailsConfig.noInputs",
                  defaultMessage: "No form inputs yet",
                })}
              </p>
              <AdminButton type="button" variant="text" size="sm" onClick={addInput}>
                {formatMessage({
                  id: "app.admin.actions.detailsConfig.addFirstInput",
                  defaultMessage: "Add Your First Input Field",
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
          <span className="label-md font-medium text-text-strong">
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
          <AdminIconButton
            onClick={() => onMove("up")}
            disabled={index === 0}
            label={formatMessage({
              id: "app.admin.actions.detailsConfig.moveUp",
              defaultMessage: "Move Up",
            })}
          >
            <RiArrowUpLine />
          </AdminIconButton>
          <AdminIconButton
            onClick={() => onMove("down")}
            disabled={index === totalInputs - 1}
            label={formatMessage({
              id: "app.admin.actions.detailsConfig.moveDown",
              defaultMessage: "Move Down",
            })}
          >
            <RiArrowDownLine />
          </AdminIconButton>
          <AdminIconButton
            variant="danger"
            className="ml-2"
            onClick={onRemove}
            label={formatMessage({
              id: "app.admin.actions.detailsConfig.delete",
              defaultMessage: "Delete",
            })}
          >
            <RiDeleteBinLine />
          </AdminIconButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AdminTextField
          id={`field-key-${input.key}`}
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.fieldKey",
            defaultMessage: "Field key",
          })}
          value={input.key}
          onChange={(e) => onUpdate({ key: e.target.value })}
          placeholder={formatMessage({
            id: "app.admin.actions.detailsConfig.fieldKeyPlaceholder",
            defaultMessage: "e.g., plantCount",
          })}
        />

        <AdminSelect
          id={`field-type-${input.key}`}
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.fieldType",
            defaultMessage: "Field type",
          })}
          value={input.type}
          onChange={(e) => onUpdate({ type: e.target.value as WorkInput["type"], options: [] })}
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
              defaultMessage: "Text area",
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
              defaultMessage: "Select dropdown",
            })}
          </option>
          <option value="multi-select">
            {formatMessage({
              id: "app.admin.actions.detailsConfig.typeMultiSelect",
              defaultMessage: "Multi-select",
            })}
          </option>
        </AdminSelect>

        <AdminTextField
          id={`field-label-${input.key}`}
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.label",
            defaultMessage: "Label",
          })}
          value={input.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder={formatMessage({
            id: "app.admin.actions.detailsConfig.labelPlaceholder",
            defaultMessage: "e.g., Number of Plants",
          })}
        />

        <AdminTextField
          id={`field-placeholder-${input.key}`}
          label={formatMessage({
            id: "app.admin.actions.detailsConfig.placeholder",
            defaultMessage: "Placeholder",
          })}
          value={input.placeholder}
          onChange={(e) => onUpdate({ placeholder: e.target.value })}
          placeholder={formatMessage({
            id: "app.admin.actions.detailsConfig.placeholderPlaceholder",
            defaultMessage: "e.g., Enter count",
          })}
        />
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
          <AdminFieldGroup
            id={`field-options-${input.key}`}
            label={formatMessage({
              id: "app.admin.actions.detailsConfig.options",
              defaultMessage: "Options",
            })}
            contentClassName="space-y-1.5"
          >
            {input.options.map((option, optIndex) => (
              <div key={optIndex} className="flex items-center gap-2">
                <AdminTextField
                  className="flex-1"
                  label={formatMessage(
                    {
                      id: "app.admin.actions.detailsConfig.optionNumber",
                      defaultMessage: "Option #{number}",
                    },
                    { number: optIndex + 1 }
                  )}
                  value={option}
                  onChange={(e) => {
                    const updated = [...input.options];
                    updated[optIndex] = e.target.value;
                    onUpdate({ options: updated });
                  }}
                />
                <AdminIconButton
                  variant="danger"
                  onClick={() => removeOption(optIndex)}
                  label={formatMessage(
                    {
                      id: "app.admin.actions.detailsConfig.removeOption",
                      defaultMessage: "Remove Option #{number}",
                    },
                    { number: optIndex + 1 }
                  )}
                >
                  <RiCloseLine />
                </AdminIconButton>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <AdminTextField
                className="flex-1"
                label={formatMessage({
                  id: "app.admin.actions.detailsConfig.addOptionLabel",
                  defaultMessage: "Add option",
                })}
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                inputProps={{
                  onKeyDown: (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  },
                }}
                placeholder={formatMessage({
                  id: "app.admin.actions.detailsConfig.addOptionPlaceholder",
                  defaultMessage: "Add option...",
                })}
              />
              <AdminIconButton
                variant="filled"
                onClick={addOption}
                label={formatMessage({
                  id: "app.admin.actions.detailsConfig.addOptionPlaceholder",
                  defaultMessage: "Add option...",
                })}
              >
                <RiAddLine />
              </AdminIconButton>
            </div>
          </AdminFieldGroup>
        </div>
      )}
    </div>
  );
}
