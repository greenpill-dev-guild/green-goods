import type { ActionInstructionConfig } from "@green-goods/shared/types/domain";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton, AdminIconButton } from "../AdminButton";
import { AdminCheckbox } from "../AdminCheckbox";
import { AdminFieldGroup } from "../AdminFieldGroup";
import { AdminTextArea, AdminTextField } from "../AdminTextField";

interface MediaConfigSectionProps {
  config: ActionInstructionConfig["uiConfig"]["media"];
  onChange: (config: ActionInstructionConfig["uiConfig"]["media"]) => void;
}

export function MediaConfigSection({ config, onChange }: MediaConfigSectionProps) {
  const { formatMessage } = useIntl();
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

  const shotNumberLabel = (number: number) =>
    formatMessage(
      { id: "app.admin.actions.mediaConfig.shotNumber", defaultMessage: "Shot #{number}" },
      { number }
    );
  const removeShotLabel = (number: number) =>
    formatMessage(
      { id: "app.admin.actions.mediaConfig.removeShot", defaultMessage: "Remove Shot #{number}" },
      { number }
    );

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <AdminTextField
        id="media-title"
        label={formatMessage({
          id: "app.admin.actions.mediaConfig.sectionTitle",
          defaultMessage: "Section title",
        })}
        value={config.title}
        onChange={(e) => onChange({ ...config, title: e.target.value })}
        placeholder={formatMessage({
          id: "app.admin.actions.mediaConfig.sectionTitlePlaceholder",
          defaultMessage: "e.g., Capture Media",
        })}
      />

      <AdminTextArea
        id="media-description"
        label={formatMessage({
          id: "app.admin.actions.mediaConfig.description",
          defaultMessage: "Description",
        })}
        value={config.description}
        onChange={(e) => onChange({ ...config, description: e.target.value })}
        rows={3}
        placeholder={formatMessage({
          id: "app.admin.actions.mediaConfig.descriptionPlaceholder",
          defaultMessage: "Provide instructions for media capture...",
        })}
      />

      {/* Image Count */}
      <div className="grid grid-cols-2 gap-4">
        <AdminTextField
          id="media-min"
          type="number"
          label={formatMessage({
            id: "app.admin.actions.mediaConfig.minImages",
            defaultMessage: "Min images",
          })}
          value={String(config.minImageCount)}
          onChange={(e) => onChange({ ...config, minImageCount: parseInt(e.target.value) || 0 })}
          inputProps={{ min: 0 }}
        />
        <AdminTextField
          id="media-max"
          type="number"
          label={formatMessage({
            id: "app.admin.actions.mediaConfig.maxImages",
            defaultMessage: "Max images",
          })}
          value={String(config.maxImageCount)}
          onChange={(e) => onChange({ ...config, maxImageCount: parseInt(e.target.value) || 1 })}
          inputProps={{ min: 1 }}
        />
      </div>

      {/* Required Toggle */}
      <AdminCheckbox
        id="media-required"
        checked={config.required}
        onChange={(e) => onChange({ ...config, required: e.target.checked })}
        label={formatMessage({
          id: "app.admin.actions.mediaConfig.required",
          defaultMessage: "Media is required",
        })}
      />

      {/* Needed Shot Types */}
      <AdminFieldGroup
        id="media-needed"
        label={formatMessage({
          id: "app.admin.actions.mediaConfig.requiredShots",
          defaultMessage: "Required shot types",
        })}
        hint={formatMessage({
          id: "app.admin.actions.mediaConfig.requiredShotsDescription",
          defaultMessage: "Specify what types of photos users must capture",
        })}
        contentClassName="space-y-2"
      >
        {config.needed.map((shot, index) => (
          <div key={index} className="flex items-center gap-2">
            <AdminTextField
              className="flex-1"
              label={shotNumberLabel(index + 1)}
              value={shot}
              onChange={(e) => {
                const updated = [...config.needed];
                updated[index] = e.target.value;
                onChange({ ...config, needed: updated });
              }}
            />
            <AdminIconButton
              variant="danger"
              onClick={() => removeNeeded(index)}
              label={removeShotLabel(index + 1)}
            >
              <RiCloseLine />
            </AdminIconButton>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <AdminTextField
            className="flex-1"
            label={formatMessage({
              id: "app.admin.actions.mediaConfig.addShotLabel",
              defaultMessage: "Add shot type",
            })}
            value={newNeeded}
            onChange={(e) => setNewNeeded(e.target.value)}
            inputProps={{
              onKeyDown: (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNeeded();
                }
              },
            }}
            placeholder={formatMessage({
              id: "app.admin.actions.mediaConfig.requiredShotsPlaceholder",
              defaultMessage: "e.g., Front view, Side view",
            })}
          />
          <AdminButton type="button" size="sm" onClick={addNeeded} leadingIcon={<RiAddLine />}>
            {formatMessage({ id: "app.admin.actions.mediaConfig.add", defaultMessage: "Add" })}
          </AdminButton>
        </div>
      </AdminFieldGroup>

      {/* Optional Shot Types */}
      <AdminFieldGroup
        id="media-optional"
        label={formatMessage({
          id: "app.admin.actions.mediaConfig.optionalShots",
          defaultMessage: "Optional shot types",
        })}
        hint={formatMessage({
          id: "app.admin.actions.mediaConfig.optionalShotsDescription",
          defaultMessage: "Suggest additional photos users can optionally include",
        })}
        contentClassName="space-y-2"
      >
        {config.optional.map((shot, index) => (
          <div key={index} className="flex items-center gap-2">
            <AdminTextField
              className="flex-1"
              label={shotNumberLabel(index + 1)}
              value={shot}
              onChange={(e) => {
                const updated = [...config.optional];
                updated[index] = e.target.value;
                onChange({ ...config, optional: updated });
              }}
            />
            <AdminIconButton
              variant="danger"
              onClick={() => removeOptional(index)}
              label={removeShotLabel(index + 1)}
            >
              <RiCloseLine />
            </AdminIconButton>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <AdminTextField
            className="flex-1"
            label={formatMessage({
              id: "app.admin.actions.mediaConfig.addShotLabel",
              defaultMessage: "Add shot type",
            })}
            value={newOptional}
            onChange={(e) => setNewOptional(e.target.value)}
            inputProps={{
              onKeyDown: (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOptional();
                }
              },
            }}
            placeholder={formatMessage({
              id: "app.admin.actions.mediaConfig.optionalShotsPlaceholder",
              defaultMessage: "e.g., Close-up, Detail shot",
            })}
          />
          <AdminButton type="button" size="sm" onClick={addOptional} leadingIcon={<RiAddLine />}>
            {formatMessage({ id: "app.admin.actions.mediaConfig.add", defaultMessage: "Add" })}
          </AdminButton>
        </div>
      </AdminFieldGroup>
    </div>
  );
}
