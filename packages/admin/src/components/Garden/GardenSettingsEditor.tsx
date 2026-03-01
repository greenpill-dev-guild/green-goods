import {
  cn,
  useUpdateGardenName,
  useUpdateGardenDescription,
  useUpdateGardenLocation,
  useUpdateGardenBannerImage,
  useSetOpenJoining,
  useSetMaxGardeners,
  type Address,
} from "@green-goods/shared";
import { RiEditLine, RiLoader4Line, RiSaveLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface GardenSettingsEditorProps {
  gardenAddress: Address;
  garden: {
    name: string;
    description: string;
    location: string;
    bannerImage: string;
    openJoining?: boolean;
    maxGardeners?: number;
  };
  canManage: boolean;
  isOwner: boolean;
}

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => void;
  isPending: boolean;
  canEdit: boolean;
  multiline?: boolean;
}

function EditableField({
  label,
  value,
  onSave,
  isPending,
  canEdit,
  multiline,
}: EditableFieldProps) {
  const { formatMessage } = useIntl();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    if (draft.trim() !== value) {
      onSave(draft.trim());
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="label-xs text-text-soft">{label}</p>
          <p className={cn("mt-1 text-sm text-text-strong", !value && "italic text-text-sub")}>
            {value ||
              formatMessage({ id: "app.garden.settings.notSet", defaultMessage: "Not set" })}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="mt-4 shrink-0 rounded-md p-1.5 text-text-soft opacity-0 transition-opacity hover:bg-bg-weak hover:text-text-strong group-hover:opacity-100"
            aria-label={formatMessage(
              { id: "app.garden.settings.edit", defaultMessage: "Edit {field}" },
              { field: label }
            )}
          >
            <RiEditLine className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="label-xs text-text-soft">{label}</p>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
          autoFocus
        />
      ) : (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
          autoFocus
        />
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending || draft.trim() === value}>
          {isPending ? (
            <RiLoader4Line className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RiSaveLine className="mr-1.5 h-3.5 w-3.5" />
          )}
          {formatMessage({ id: "app.common.save", defaultMessage: "Save" })}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleCancel} disabled={isPending}>
          {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        </Button>
      </div>
    </div>
  );
}

export function GardenSettingsEditor({
  gardenAddress,
  garden,
  canManage,
  isOwner,
}: GardenSettingsEditorProps) {
  const { formatMessage } = useIntl();

  const updateName = useUpdateGardenName();
  const updateDescription = useUpdateGardenDescription();
  const updateLocation = useUpdateGardenLocation();
  const updateBannerImage = useUpdateGardenBannerImage();
  const setOpenJoining = useSetOpenJoining();
  const setMaxGardeners = useSetMaxGardeners();

  const [maxInput, setMaxInput] = useState(String(garden.maxGardeners ?? 0));

  return (
    <Card>
      <Card.Header>
        <h3 className="label-md text-text-strong">
          {formatMessage({
            id: "app.garden.settings.title",
            defaultMessage: "Garden Settings",
          })}
        </h3>
        <p className="mt-1 text-xs text-text-sub">
          {formatMessage({
            id: "app.garden.settings.description",
            defaultMessage: "Update garden profile and configuration",
          })}
        </p>
      </Card.Header>
      <Card.Body className="space-y-4">
        <EditableField
          label={formatMessage({ id: "app.garden.settings.name", defaultMessage: "Name" })}
          value={garden.name}
          onSave={(v) => updateName.mutate({ gardenAddress, value: v })}
          isPending={updateName.isPending}
          canEdit={isOwner}
        />

        <div className="border-t border-stroke-soft" />

        <EditableField
          label={formatMessage({
            id: "app.garden.settings.description",
            defaultMessage: "Description",
          })}
          value={garden.description}
          onSave={(v) => updateDescription.mutate({ gardenAddress, value: v })}
          isPending={updateDescription.isPending}
          canEdit={canManage}
          multiline
        />

        <div className="border-t border-stroke-soft" />

        <EditableField
          label={formatMessage({ id: "app.garden.settings.location", defaultMessage: "Location" })}
          value={garden.location}
          onSave={(v) => updateLocation.mutate({ gardenAddress, value: v })}
          isPending={updateLocation.isPending}
          canEdit={canManage}
        />

        <div className="border-t border-stroke-soft" />

        <EditableField
          label={formatMessage({
            id: "app.garden.settings.bannerImage",
            defaultMessage: "Banner Image URL",
          })}
          value={garden.bannerImage}
          onSave={(v) => updateBannerImage.mutate({ gardenAddress, value: v })}
          isPending={updateBannerImage.isPending}
          canEdit={canManage}
        />

        <div className="border-t border-stroke-soft" />

        {/* Open Joining Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="label-xs text-text-soft">
              {formatMessage({
                id: "app.garden.settings.openJoining",
                defaultMessage: "Open Joining",
              })}
            </p>
            <p className="mt-1 text-xs text-text-sub">
              {formatMessage({
                id: "app.garden.settings.openJoiningDescription",
                defaultMessage: "Allow anyone to join this garden without an invitation",
              })}
            </p>
          </div>
          <button
            type="button"
            disabled={!canManage || setOpenJoining.isPending}
            onClick={() => setOpenJoining.mutate({ gardenAddress, value: !garden.openJoining })}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-base focus:ring-offset-2",
              garden.openJoining ? "bg-primary-base" : "bg-bg-strong",
              (!canManage || setOpenJoining.isPending) && "cursor-not-allowed opacity-50"
            )}
            role="switch"
            aria-checked={!!garden.openJoining}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-bg-white shadow ring-0 transition duration-200 ease-in-out",
                garden.openJoining ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <div className="border-t border-stroke-soft" />

        {/* Max Gardeners */}
        <div className="group flex items-center justify-between gap-4">
          <div>
            <p className="label-xs text-text-soft">
              {formatMessage({
                id: "app.garden.settings.maxGardeners",
                defaultMessage: "Max Gardeners",
              })}
            </p>
            <p className="mt-1 text-xs text-text-sub">
              {formatMessage({
                id: "app.garden.settings.maxGardenersDescription",
                defaultMessage: "0 means unlimited",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              disabled={!canManage || setMaxGardeners.isPending}
              className="w-20 rounded-lg border border-stroke-sub bg-bg-white px-2 py-1.5 text-right text-sm text-text-strong focus:border-primary-base focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            {canManage && Number(maxInput) !== (garden.maxGardeners ?? 0) && (
              <Button
                size="sm"
                onClick={() =>
                  setMaxGardeners.mutate({
                    gardenAddress,
                    value: Number(maxInput),
                  })
                }
                disabled={setMaxGardeners.isPending}
              >
                {setMaxGardeners.isPending ? (
                  <RiLoader4Line className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  formatMessage({ id: "app.common.save", defaultMessage: "Save" })
                )}
              </Button>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
