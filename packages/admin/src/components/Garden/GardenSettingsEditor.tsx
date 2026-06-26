import {
  type Address,
  Card,
  cn,
  FileUploadField,
  FormField,
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
import { RiCloseLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";

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

interface SettingsDraft {
  name: string;
  description: string;
  location: string;
  openJoining: boolean;
  maxGardeners: string;
  /** Locally selected banner file — uploads to IPFS only on Save. */
  bannerFile: File | null;
  /** Marks the saved banner for removal on Save. */
  bannerRemoved: boolean;
}

function draftFromGarden(garden: GardenSettingsEditorProps["garden"]): SettingsDraft {
  return {
    name: garden.name,
    description: garden.description,
    location: garden.location,
    openJoining: !!garden.openJoining,
    maxGardeners: String(garden.maxGardeners ?? 0),
    bannerFile: null,
    bannerRemoved: false,
  };
}

/**
 * Explicit-save garden settings form.
 *
 * Every field edits a local draft; nothing reaches IPFS or the chain until
 * Save. Save runs only the dirty fields through their existing per-field
 * mutations (each keeps its own loading/success toast), and the banner file
 * shows a local object-URL preview until Save uploads it. Cancel resets the
 * draft to the last saved values.
 */
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

  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromGarden(garden));
  const [isSaving, setIsSaving] = useState(false);

  // Local preview for a freshly selected banner file. Revoked on change and
  // unmount so draft previews never leak object URLs.
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!draft.bannerFile) {
      setBannerPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(draft.bannerFile);
    setBannerPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.bannerFile]);

  // Adopt refreshed garden values (post-save invalidation, garden switch)
  // whenever the operator has no pending edits — never clobber a dirty draft.
  const gardenSnapshot = JSON.stringify([
    garden.name,
    garden.description,
    garden.location,
    garden.bannerImage,
    !!garden.openJoining,
    garden.maxGardeners ?? 0,
  ]);
  const lastSnapshotRef = useRef(gardenSnapshot);

  // Plain per-render computation — string compares against the saved values.
  const baseline = draftFromGarden(garden);
  const dirtyFields: string[] = [];
  if (draft.name.trim() !== baseline.name) dirtyFields.push("name");
  if (draft.description.trim() !== baseline.description) dirtyFields.push("description");
  if (draft.location.trim() !== baseline.location) dirtyFields.push("location");
  if (draft.openJoining !== baseline.openJoining) dirtyFields.push("openJoining");
  if (Number(draft.maxGardeners) !== Number(baseline.maxGardeners))
    dirtyFields.push("maxGardeners");
  if (draft.bannerFile || draft.bannerRemoved) dirtyFields.push("banner");
  const isDirty = dirtyFields.length > 0;

  useEffect(() => {
    if (lastSnapshotRef.current === gardenSnapshot) return;
    lastSnapshotRef.current = gardenSnapshot;
    if (!isDirty && !isSaving) {
      setDraft(draftFromGarden(garden));
    }
    // The snapshot-equality guard above is the real trigger; isDirty/isSaving/
    // garden are listed so the guard always reads current values (no stale
    // closure) and the effect no longer needs an exhaustive-deps suppression.
  }, [gardenSnapshot, isDirty, isSaving, garden]);

  const canEditProfile = canManage;
  const canEditName = isOwner;
  const canEditAnything = canEditProfile || canEditName;

  const nameInvalid = canEditName && draft.name.trim().length === 0;
  const maxGardenersNumber = Number(draft.maxGardeners);
  const maxGardenersInvalid =
    !Number.isInteger(maxGardenersNumber) ||
    Number.isNaN(maxGardenersNumber) ||
    maxGardenersNumber < 0;
  const hasValidationError = nameInvalid || maxGardenersInvalid;

  const resolvedSavedBanner =
    garden.bannerImage && !draft.bannerRemoved ? resolveIPFSUrl(garden.bannerImage) : "";
  const previewSrc = bannerPreviewUrl ?? resolvedSavedBanner;

  const handleCancel = () => {
    setDraft(draftFromGarden(garden));
  };

  const handleSave = async () => {
    if (!isDirty || hasValidationError || isSaving) return;

    setIsSaving(true);
    try {
      // Each dirty field reuses its existing mutation (own toast + cache
      // invalidation). Sequential on purpose: one wallet confirmation at a
      // time, and a failure stops the run with the draft intact.
      if (dirtyFields.includes("name")) {
        await updateName.mutateAsync({ gardenAddress, value: draft.name.trim() });
      }
      if (dirtyFields.includes("description")) {
        await updateDescription.mutateAsync({ gardenAddress, value: draft.description.trim() });
      }
      if (dirtyFields.includes("location")) {
        await updateLocation.mutateAsync({ gardenAddress, value: draft.location.trim() });
      }
      if (dirtyFields.includes("openJoining")) {
        await setOpenJoining.mutateAsync({ gardenAddress, value: draft.openJoining });
      }
      if (dirtyFields.includes("maxGardeners")) {
        await setMaxGardeners.mutateAsync({ gardenAddress, value: maxGardenersNumber });
      }
      if (dirtyFields.includes("banner")) {
        if (draft.bannerFile) {
          let file = draft.bannerFile;
          if (imageCompressor.shouldCompress(file, 1024)) {
            const result = await imageCompressor.compressImage(file, {
              maxSizeMB: 0.8,
              maxWidthOrHeight: 2048,
            });
            file = result.file;
          }
          const uploadResult = await uploadFileToIPFS(file);
          await updateBannerImage.mutateAsync({
            gardenAddress,
            value: resolveIPFSUrl(uploadResult.cid),
          });
        } else if (draft.bannerRemoved) {
          await updateBannerImage.mutateAsync({ gardenAddress, value: "" });
        }
      }

      // Clear banner draft state; field values stay and become the new
      // baseline when the invalidated garden query refreshes the props.
      setDraft((current) => ({ ...current, bannerFile: null, bannerRemoved: false }));
    } catch (error) {
      // Contract mutations already toast their own parsed errors; the IPFS
      // upload path is the one failure with no mutation toast of its own.
      logger.error("Garden settings save failed", { error, source: "GardenSettingsEditor" });
      toastService.error({
        title: formatMessage({
          id: "app.garden.create.uploadFailed",
          defaultMessage: "Upload failed",
        }),
        message: formatMessage({
          id: "app.garden.settings.saveFailedMessage",
          defaultMessage: "Your edits are still here — review the error and save again.",
        }),
        context: "garden settings save",
        error,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const disabledProfileField = !canEditProfile || isSaving;

  return (
    <Card data-component="GardenSettingsEditor">
      <Card.Header>
        <h3 className="label-md text-text-strong">
          {formatMessage({
            id: "app.garden.settings.title",
            defaultMessage: "Garden Settings",
          })}
        </h3>
        <p className="mt-1 text-xs text-text-sub">
          {formatMessage({
            id: "app.garden.settings.explicitSave",
            defaultMessage: "Changes stay local until you save them.",
          })}
        </p>
      </Card.Header>
      <Card.Body className="space-y-5">
        <FormField
          label={formatMessage({ id: "app.garden.settings.name", defaultMessage: "Name" })}
          htmlFor="garden-settings-name"
          required={canEditName}
          error={
            nameInvalid
              ? formatMessage({
                  id: "app.garden.settings.nameRequired",
                  defaultMessage: "Garden name is required",
                })
              : undefined
          }
        >
          <TextInput
            surface="admin"
            id="garden-settings-name"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
            maxLength={GARDEN_NAME_MAX_LENGTH}
            disabled={!canEditName || isSaving}
            aria-invalid={nameInvalid || undefined}
          />
          <p
            className={cn(
              "mt-1 text-right text-xs tabular-nums",
              draft.name.length > GARDEN_NAME_MAX_LENGTH * 0.85
                ? "text-warning-base"
                : "text-text-soft"
            )}
          >
            {draft.name.length}/{GARDEN_NAME_MAX_LENGTH}
          </p>
        </FormField>

        <FormField
          label={formatMessage({
            id: "app.garden.settings.descriptionLabel",
            defaultMessage: "Description",
          })}
          htmlFor="garden-settings-description"
        >
          <Textarea
            surface="admin"
            id="garden-settings-description"
            value={draft.description}
            onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
            rows={3}
            disabled={disabledProfileField}
            className="resize-y"
          />
        </FormField>

        <FormField
          label={formatMessage({ id: "app.garden.settings.location", defaultMessage: "Location" })}
          htmlFor="garden-settings-location"
        >
          <TextInput
            surface="admin"
            id="garden-settings-location"
            type="text"
            value={draft.location}
            onChange={(e) => setDraft((current) => ({ ...current, location: e.target.value }))}
            disabled={disabledProfileField}
          />
        </FormField>

        <div className="border-t border-stroke-soft" />

        {/* Banner image — local draft preview; uploads on Save. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="label-xs text-text-soft">
              {formatMessage({
                id: "app.garden.create.bannerImageLabel",
                defaultMessage: "Banner image",
              })}
            </p>
            {canEditProfile && previewSrc ? (
              <AdminButton
                type="button"
                variant="text"
                size="sm"
                leadingIcon={<RiCloseLine />}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    bannerFile: null,
                    bannerRemoved: Boolean(garden.bannerImage),
                  }))
                }
                disabled={isSaving}
              >
                {formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
              </AdminButton>
            ) : null}
          </div>

          <div className="relative h-28 w-full overflow-hidden rounded-lg">
            {previewSrc ? (
              <ImageWithFallback
                src={previewSrc}
                alt={formatMessage({ id: "app.garden.detail.bannerAlt" }, { name: garden.name })}
                className="h-28 w-full object-cover"
                backgroundFallback={<GardenBannerFallback name={garden.name} />}
              />
            ) : (
              <GardenBannerFallback name={garden.name} />
            )}
            {draft.bannerFile ? (
              <span className="absolute bottom-2 right-2 rounded-full bg-bg-white/90 px-2 py-0.5 text-[11px] font-medium text-text-sub shadow-[var(--edge-rest)]">
                {formatMessage({
                  id: "app.garden.settings.bannerDraft",
                  defaultMessage: "Preview — uploads on save",
                })}
              </span>
            ) : null}
          </div>

          {canEditProfile ? (
            <FileUploadField
              accept="image/*"
              showPreview={false}
              disabled={isSaving}
              helpText={formatMessage({
                id: "app.garden.create.bannerImageHelp",
                defaultMessage: "Upload a banner image showcasing the garden (optional)",
              })}
              onFilesChange={(files) => {
                const file = files[0];
                if (!file) return;
                setDraft((current) => ({ ...current, bannerFile: file, bannerRemoved: false }));
              }}
            />
          ) : null}
        </div>

        <div className="border-t border-stroke-soft" />

        {/* Open Joining */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="label-xs text-text-soft" id="garden-settings-open-joining-label">
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
            disabled={disabledProfileField}
            checked={draft.openJoining}
            onCheckedChange={(checked) =>
              setDraft((current) => ({ ...current, openJoining: checked === true }))
            }
            surface="admin"
            aria-labelledby="garden-settings-open-joining-label"
            className={cn(disabledProfileField && "cursor-not-allowed opacity-50")}
          />
        </div>

        <div className="border-t border-stroke-soft" />

        {/* Max Gardeners */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="label-xs text-text-soft" htmlFor="garden-settings-max-gardeners">
              {formatMessage({
                id: "app.garden.settings.maxGardeners",
                defaultMessage: "Max Gardeners",
              })}
            </label>
            <p className="mt-1 text-xs text-text-sub">
              {formatMessage({
                id: "app.garden.settings.maxGardenersDescription",
                defaultMessage: "0 means unlimited",
              })}
            </p>
          </div>
          <TextInput
            surface="admin"
            id="garden-settings-max-gardeners"
            type="number"
            min={0}
            step={1}
            value={draft.maxGardeners}
            onChange={(e) => setDraft((current) => ({ ...current, maxGardeners: e.target.value }))}
            disabled={disabledProfileField}
            aria-invalid={maxGardenersInvalid || undefined}
            className="w-24 text-right"
          />
        </div>
      </Card.Body>

      {canEditAnything ? (
        <Card.Footer className="flex flex-wrap items-center justify-between gap-3">
          <p
            className={cn("text-xs", isDirty ? "text-warning-dark" : "text-text-soft")}
            aria-live="polite"
            data-slot="dirty-state"
          >
            {isSaving
              ? formatMessage({
                  id: "app.garden.settings.saving",
                  defaultMessage: "Saving changes…",
                })
              : isDirty
                ? formatMessage(
                    {
                      id: "app.garden.settings.unsavedChanges",
                      defaultMessage:
                        "{count, plural, one {# unsaved change} other {# unsaved changes}}",
                    },
                    { count: dirtyFields.length }
                  )
                : formatMessage({
                    id: "app.garden.settings.allSaved",
                    defaultMessage: "All changes saved",
                  })}
          </p>
          <div className="flex items-center gap-2">
            <AdminButton
              type="button"
              variant="text"
              onClick={handleCancel}
              disabled={!isDirty || isSaving}
            >
              {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              variant="filled"
              onClick={() => void handleSave()}
              disabled={!isDirty || hasValidationError || isSaving}
              loading={isSaving}
            >
              {formatMessage({
                id: "app.garden.settings.saveChanges",
                defaultMessage: "Save changes",
              })}
            </AdminButton>
          </div>
        </Card.Footer>
      ) : null}
    </Card>
  );
}
