import {
  type Address,
  Button,
  Card,
  cn,
  FileUploadField,
  GARDEN_NAME_MAX_LENGTH,
  GardenBannerFallback,
  ImageWithFallback,
  imageCompressor,
  logger,
  resolveIPFSUrl,
  Switch,
  Textarea,
  TextInput,
  toastService,
  uploadFileToIPFS,
  useSetMaxGardeners,
  useSetOpenJoining,
  useUpdateGardenBannerImage,
  useUpdateGardenDescription,
  useUpdateGardenLocation,
  useUpdateGardenName,
} from "@green-goods/shared";
import { RiCloseLine, RiEditLine, RiLoader4Line, RiSaveLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

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
  maxLength?: number;
}

function EditableField({
  label,
  value,
  onSave,
  isPending,
  canEdit,
  multiline,
  maxLength,
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
          <p
            className={cn(
              "mt-1 max-w-prose text-sm text-text-strong",
              !value && "italic text-text-sub",
              multiline && "line-clamp-3"
            )}
            title={value || undefined}
          >
            {value ||
              formatMessage({ id: "app.garden.settings.notSet", defaultMessage: "Not set" })}
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="mt-4 h-auto min-w-0 shrink-0 rounded-md p-1.5 text-text-soft opacity-0 transition-opacity hover:bg-bg-weak hover:text-text-strong group-hover:opacity-100"
            aria-label={formatMessage(
              { id: "app.garden.settings.edit", defaultMessage: "Edit {field}" },
              { field: label }
            )}
          >
            <RiEditLine className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="label-xs text-text-soft">{label}</p>
      {multiline ? (
        <Textarea
          surface="admin"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
        />
      ) : (
        <TextInput
          surface="admin"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={maxLength}
          className="w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
        />
      )}
      {maxLength && (
        <p
          className={cn(
            "text-right text-xs tabular-nums",
            draft.length > maxLength
              ? "text-error-base"
              : draft.length > maxLength * 0.85
                ? "text-warning-base"
                : "text-text-soft"
          )}
        >
          {draft.length}/{maxLength}
        </p>
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

/**
 * Banner image field with upload-to-IPFS + live preview (PRD-513).
 *
 * Replaces the prior text-only URL field, which rendered the saved value as a
 * bare link with no preview, leaving operators unable to see the image they
 * uploaded. Mirrors the create-flow uploader (`DetailsStep.handleBannerUpload`)
 * and routes the on-chain write through `useUpdateGardenBannerImage`, which owns
 * the loading/success toast and cache invalidation.
 */
function BannerImageField({
  gardenAddress,
  bannerImage,
  gardenName,
  canEdit,
}: {
  gardenAddress: Address;
  bannerImage: string;
  gardenName: string;
  canEdit: boolean;
}) {
  const { formatMessage } = useIntl();
  const updateBannerImage = useUpdateGardenBannerImage();
  const [isUploading, setIsUploading] = useState(false);
  // Optimistic preview: resolved URL of the image we just uploaded, shown
  // immediately while the on-chain update confirms and re-indexes.
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  const resolvedCurrent = bannerImage ? resolveIPFSUrl(bannerImage) : "";
  const previewSrc = pendingPreview ?? resolvedCurrent;
  const isPending = isUploading || updateBannerImage.isPending;

  const handleUpload = async (files: File[]) => {
    let file = files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (imageCompressor.shouldCompress(file, 1024)) {
        const result = await imageCompressor.compressImage(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 2048,
        });
        file = result.file;
      }

      const uploadResult = await uploadFileToIPFS(file);
      const ipfsUrl = resolveIPFSUrl(uploadResult.cid);

      setPendingPreview(ipfsUrl);
      // Roll the optimistic preview back if the on-chain write fails, so the UI
      // never contradicts the mutation's own error toast (sensitive write surface).
      updateBannerImage.mutate(
        { gardenAddress, value: ipfsUrl },
        { onError: () => setPendingPreview(null) }
      );
    } catch (error) {
      logger.error("Banner upload failed", { error, source: "GardenSettingsEditor" });
      toastService.error({
        title: formatMessage({
          id: "app.garden.create.uploadFailed",
          defaultMessage: "Upload failed",
        }),
        message: formatMessage({
          id: "app.garden.create.uploadFailedMessage",
          defaultMessage: "Could not upload banner image. Please try again.",
        }),
        context: "banner upload",
        error,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPendingPreview(null);
    updateBannerImage.mutate({ gardenAddress, value: "" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="label-xs text-text-soft">
          {formatMessage({
            id: "app.garden.create.bannerImageLabel",
            defaultMessage: "Banner image",
          })}
        </p>
        {canEdit && previewSrc ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={isPending}
            className="h-auto min-w-0 shrink-0 rounded-md px-1.5 py-1 text-text-soft hover:bg-bg-weak hover:text-text-strong"
          >
            {isPending ? (
              <RiLoader4Line className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RiCloseLine className="mr-1 h-3.5 w-3.5" />
            )}
            {formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
          </Button>
        ) : null}
      </div>

      <div className="h-28 w-full overflow-hidden rounded-lg">
        {previewSrc ? (
          <ImageWithFallback
            src={previewSrc}
            alt={formatMessage({ id: "app.garden.detail.bannerAlt" }, { name: gardenName })}
            className="h-28 w-full object-cover"
            backgroundFallback={<GardenBannerFallback name={gardenName} />}
          />
        ) : (
          <GardenBannerFallback name={gardenName} />
        )}
      </div>

      {canEdit ? (
        <FileUploadField
          accept="image/*"
          showPreview={false}
          disabled={isPending}
          helpText={formatMessage({
            id: "app.garden.create.bannerImageHelp",
            defaultMessage: "Upload a hero image showcasing the garden (optional)",
          })}
          onFilesChange={handleUpload}
        />
      ) : null}
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
          maxLength={GARDEN_NAME_MAX_LENGTH}
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

        <BannerImageField
          gardenAddress={gardenAddress}
          bannerImage={garden.bannerImage}
          gardenName={garden.name}
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
          <Switch
            disabled={!canManage || setOpenJoining.isPending}
            checked={!!garden.openJoining}
            onCheckedChange={() =>
              setOpenJoining.mutate({ gardenAddress, value: !garden.openJoining })
            }
            surface="admin"
            className={cn(
              (!canManage || setOpenJoining.isPending) && "cursor-not-allowed opacity-50"
            )}
          />
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
            <TextInput
              surface="admin"
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
