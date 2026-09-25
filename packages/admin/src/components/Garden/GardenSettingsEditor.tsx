import { FileUploadField } from "@green-goods/shared/components/FileUploadField";
import { Switch } from "@green-goods/shared/components/Form/ControlPrimitives";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import {
  GARDEN_NAME_MAX_LENGTH,
  gardenNameFits,
} from "@green-goods/shared/hooks/garden/useCreateGardenForm";
import { useSetGardenDomains } from "@green-goods/shared/hooks/garden/useSetGardenDomains";
import {
  useSetMaxGardeners,
  useSetOpenJoining,
  useUpdateGardenBannerImage,
  useUpdateGardenDescription,
  useUpdateGardenLocation,
  useUpdateGardenName,
} from "@green-goods/shared/hooks/garden/useUpdateGarden";
import { logger } from "@green-goods/shared/modules/app/logger";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { uploadFileToIPFS } from "@green-goods/shared/modules/data/ipfs/upload";
import { type Address, DOMAIN_COLORS, type Domain } from "@green-goods/shared/types/domain";
import { isTransactionHash } from "@green-goods/shared/utils/eas/explorers";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { imageCompressor } from "@green-goods/shared/utils/work/image-compression";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminFieldGroup } from "@/components/AdminFieldGroup";
import { AdminSelectableCard } from "@/components/AdminSelectableCard";
import { AdminSettingRow } from "@/components/AdminSettingRow";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import {
  DOMAIN_OPTIONS,
  dirtyFieldsOf,
  draftFromGarden,
  effectiveMaxGardeners,
  fieldValueKey,
  type GardenSettingsField,
  type GardenSettingsValues,
  type SettingsDraft,
} from "./gardenSettingsDraft";
import type {
  GardenSettingsFieldProgress,
  GardenSettingsFieldState,
  GardenSettingsSaveRun,
} from "./gardenSettingsSave";

/** What the hosting surface should show as the banner right now. */
export interface GardenBannerPreview {
  /** Resolved image URL, or null when there is no banner (none or removed). */
  src: string | null;
  /** True while a locally staged file is previewing (uploads on Save). */
  isDraft: boolean;
  /** True when a saved banner is staged for removal on Save. */
  isStagedRemoval: boolean;
  /** True when there is an image the steward is allowed to remove. */
  canRemove: boolean;
}

/**
 * Draft state the form reports up so the hosting dialog can render the pinned
 * footer (status line + Cancel/Save) and guard its close.
 */
export interface GardenSettingsFormState {
  isDirty: boolean;
  isSaving: boolean;
  /** True while a field fails validation — Save must stay disabled. */
  hasValidationError: boolean;
  /** Changed fields still to save, one wallet confirmation each — feeds the footer line. */
  dirtyCount: number;
  /** Whether the steward can edit anything — hides the footer when false. */
  canEdit: boolean;
  /** The latest Save or Try Again and where each of its writes stands; null before one. */
  run: GardenSettingsSaveRun | null;
}

/** Imperative surface for the hosting dialog's footer + banner preview card. */
export interface GardenSettingsEditorHandle {
  /** Save the dirty fields (no-op when pristine, invalid, or already saving). */
  save: () => Promise<void>;
  /** Stage the saved banner for removal (host preview card's Remove control). */
  stageBannerRemoval: () => void;
  /** Undo a staged banner removal (host preview card's Undo control). */
  undoBannerRemoval: () => void;
  /** Leave a stopped or finished save's progress and show the form again. */
  dismissRun: () => void;
}

interface GardenSettingsEditorProps {
  gardenAddress: Address;
  garden: GardenSettingsValues;
  canManage: boolean;
  isOwner: boolean;
  /**
   * Reports the current banner (saved, staged draft, or staged removal) so the
   * hosting dialog's identity preview card can render it and its Remove/Undo
   * controls — the form itself carries the uploader only, never a second image.
   */
  onBannerPreviewChange?: (preview: GardenBannerPreview) => void;
  /**
   * Reports draft dirtiness, save-in-flight, and validation so the hosting
   * dialog can guard its close (confirm-before-discard when dirty, hard-block
   * while saving) and drive its pinned footer — the form owns the draft, the
   * dialog owns the close and the footer.
   */
  onDirtyStateChange?: (state: GardenSettingsFormState) => void;
}

/**
 * Explicit-save garden settings form.
 *
 * Every field edits a local draft; nothing reaches IPFS or the chain until
 * Save. Save runs only the dirty fields through their existing per-field
 * mutations (each keeps its own loading/success toast), and the banner file
 * shows a local object-URL preview until Save uploads it. The hosting dialog's
 * footer drives Save through the imperative handle, and its identity preview
 * card drives banner Remove/Undo through the same handle, so those controls
 * never scroll away with the form.
 */
export const GardenSettingsEditor = forwardRef<
  GardenSettingsEditorHandle,
  GardenSettingsEditorProps
>(function GardenSettingsEditor(
  { gardenAddress, garden, canManage, isOwner, onBannerPreviewChange, onDirtyStateChange },
  ref
) {
  const { formatMessage } = useIntl();

  const updateName = useUpdateGardenName();
  const updateDescription = useUpdateGardenDescription();
  const updateLocation = useUpdateGardenLocation();
  const updateBannerImage = useUpdateGardenBannerImage();
  const setOpenJoining = useSetOpenJoining();
  const setMaxGardeners = useSetMaxGardeners();
  const setGardenDomains = useSetGardenDomains();

  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromGarden(garden));
  const [isSaving, setIsSaving] = useState(false);
  const [run, setRun] = useState<GardenSettingsSaveRun | null>(null);
  // What each field landed with this session, so Try Again never sends it twice
  // while the refreshed garden has yet to report it.
  const [landed, setLanded] = useState<Partial<Record<GardenSettingsField, string>>>({});

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
  // whenever the steward has no pending edits — never clobber a dirty draft.
  const gardenSnapshot = JSON.stringify([
    garden.name,
    garden.description,
    garden.location,
    garden.bannerImage,
    garden.domainMask ?? 0,
    !!garden.openJoining,
    garden.maxGardeners ?? 0,
  ]);
  const lastSnapshotRef = useRef(gardenSnapshot);

  // Plain per-render computation — compares against the saved values.
  const dirtyFields = dirtyFieldsOf(draft, garden);
  const isDirty = dirtyFields.length > 0;
  // What Save still sends: a field that landed this session and still holds
  // that value waits for the refreshed garden instead of being written again.
  const pendingFields = dirtyFields.filter(
    (field) => field === "banner" || landed[field] !== fieldValueKey(draft, field)
  );

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
  const nameTooLong = canEditName && !gardenNameFits(draft.name);
  const maxGardenersInvalid =
    draft.limitGardeners &&
    (draft.maxGardeners.trim() === "" ||
      !Number.isInteger(Number(draft.maxGardeners)) ||
      Number(draft.maxGardeners) < 1);
  // Unreachable via the min-one toggle guard, but keeps Save honest if a garden
  // ever reaches an empty selection through some other path.
  const domainsInvalid = dirtyFields.includes("domains") && draft.domains.length === 0;
  const hasValidationError = nameInvalid || nameTooLong || maxGardenersInvalid || domainsInvalid;

  const resolvedSavedBanner =
    garden.bannerImage && !draft.bannerRemoved ? resolveIPFSUrl(garden.bannerImage) : "";
  const previewSrc = bannerPreviewUrl ?? resolvedSavedBanner;
  const bannerIsDraft = Boolean(draft.bannerFile);
  const bannerStagedRemoval = draft.bannerRemoved && !draft.bannerFile;
  const canRemoveBanner = canEditProfile && Boolean(previewSrc);

  // Keep the hosting surface's identity preview in sync with the draft — the
  // image renders there (once), not inside this form.
  useEffect(() => {
    onBannerPreviewChange?.({
      src: previewSrc || null,
      isDraft: bannerIsDraft,
      isStagedRemoval: bannerStagedRemoval,
      canRemove: canRemoveBanner,
    });
  }, [bannerIsDraft, bannerStagedRemoval, canRemoveBanner, onBannerPreviewChange, previewSrc]);

  const dirtyCount = pendingFields.length;

  useEffect(() => {
    onDirtyStateChange?.({
      isDirty: dirtyCount > 0,
      isSaving,
      hasValidationError,
      dirtyCount,
      canEdit: canEditAnything,
      run,
    });
  }, [dirtyCount, isSaving, hasValidationError, canEditAnything, run, onDirtyStateChange]);

  // Each field reuses its existing mutation (own toast + cache invalidation)
  // and resolves with the transaction that carried it.
  const writeField = async (
    field: GardenSettingsField,
    values: SettingsDraft,
    onUploaded: () => void
  ): Promise<`0x${string}`> => {
    switch (field) {
      case "name":
        return updateName.mutateAsync({ gardenAddress, value: values.name.trim() });
      case "description":
        return updateDescription.mutateAsync({ gardenAddress, value: values.description.trim() });
      case "location":
        return updateLocation.mutateAsync({ gardenAddress, value: values.location.trim() });
      case "openJoining":
        return setOpenJoining.mutateAsync({ gardenAddress, value: values.openJoining });
      case "maxGardeners":
        return setMaxGardeners.mutateAsync({ gardenAddress, value: effectiveMaxGardeners(values) });
      case "domains":
        return setGardenDomains.mutateAsync({ gardenAddress, domains: values.domains });
      case "banner": {
        if (!values.bannerFile) return updateBannerImage.mutateAsync({ gardenAddress, value: "" });
        let file = values.bannerFile;
        if (imageCompressor.shouldCompress(file, 1024)) {
          const result = await imageCompressor.compressImage(file, {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 2048,
          });
          file = result.file;
        }
        const uploadResult = await uploadFileToIPFS(file);
        onUploaded();
        return updateBannerImage.mutateAsync({
          gardenAddress,
          value: resolveIPFSUrl(uploadResult.cid),
        });
      }
    }
  };

  const handleSave = async () => {
    if (pendingFields.length === 0 || hasValidationError || isSaving) return;

    // The run writes the draft as it stands now; fields are locked until it ends.
    const values = draft;
    const fields = pendingFields;
    const progress: Partial<Record<GardenSettingsField, GardenSettingsFieldProgress>> = {};
    const report = (status: GardenSettingsSaveRun["status"]) =>
      setRun({ status, fields, progress: { ...progress } });
    const mark = (
      field: GardenSettingsField,
      state: GardenSettingsFieldState,
      hash: `0x${string}` | null = null
    ) => {
      progress[field] = { state, hash };
      report(state === "failed" ? "stopped" : "running");
    };

    setIsSaving(true);
    for (const field of fields) progress[field] = { state: "queued", hash: null };
    // Sequential on purpose: one wallet confirmation at a time, and a failure
    // stops the run with the rest of the draft intact.
    for (const field of fields) {
      let stage: GardenSettingsFieldState =
        field === "banner" && values.bannerFile ? "uploading" : "waiting";
      mark(field, stage);
      try {
        const hash = await writeField(field, values, () => {
          stage = "waiting";
          mark(field, stage);
        });
        // A Safe hands back a proposal, not a transaction: the field is sent,
        // not confirmed, and is not sent again, which would propose it twice.
        if (isTransactionHash(hash)) mark(field, "saved", hash);
        else mark(field, "proposed");
        if (field === "banner") {
          setDraft((current) => ({ ...current, bannerFile: null, bannerRemoved: false }));
        } else {
          setLanded((current) => ({ ...current, [field]: fieldValueKey(values, field) }));
        }
      } catch (error) {
        mark(field, "failed");
        logger.error("Garden settings save failed", {
          error,
          field,
          source: "GardenSettingsEditor",
        });
        // Contract writes toast their own parsed errors; the image upload is
        // the one step with no toast of its own.
        if (stage === "uploading") {
          toastService.error({
            title: formatMessage({
              id: "app.garden.create.uploadFailed",
              defaultMessage: "Upload failed",
            }),
            message: formatMessage({
              id: "app.garden.settings.saveFailedMessage",
              defaultMessage: "Your edits are still here. Review the error and save again.",
            }),
            context: "garden settings save",
            error,
          });
        }
        setIsSaving(false);
        return;
      }
    }
    report("complete");
    setIsSaving(false);
  };

  // The hosting dialog's pinned footer drives Save through this handle, and its
  // identity preview card drives banner Remove/Undo — so those controls live
  // outside the scrolling form body.
  useImperativeHandle(ref, () => ({
    save: handleSave,
    stageBannerRemoval: () =>
      setDraft((current) => ({
        ...current,
        bannerFile: null,
        bannerRemoved: Boolean(garden.bannerImage),
      })),
    undoBannerRemoval: () => setDraft((current) => ({ ...current, bannerRemoved: false })),
    dismissRun: () => setRun(null),
  }));

  const disabledProfileField = !canEditProfile || isSaving;

  const toggleDomain = (domain: Domain) => {
    setDraft((current) => {
      if (current.domains.includes(domain)) {
        // Keep at least one domain — a garden with none can document no work.
        if (current.domains.length <= 1) return current;
        return { ...current, domains: current.domains.filter((entry) => entry !== domain) };
      }
      return { ...current, domains: [...current.domains, domain] };
    });
  };

  return (
    // Form sections render directly — the hosting dialog's header owns the
    // title, so the editor carries no Card chrome of its own (no double
    // header inside a dialog).
    <section data-component="GardenSettingsEditor">
      <div className="space-y-5">
        {/* Counted in UTF-8 bytes, as `updateName` counts it: past 72 the
            field says why, and Save waits. */}
        <AdminTextField
          id="garden-settings-name"
          label={formatMessage({ id: "app.garden.settings.name", defaultMessage: "Name" })}
          required={canEditName}
          error={
            nameInvalid
              ? formatMessage({
                  id: "app.garden.settings.nameRequired",
                  defaultMessage: "Garden name is required",
                })
              : undefined
          }
          value={draft.name}
          onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
          disabled={!canEditName || isSaving}
          helperText={
            canEditName
              ? undefined
              : formatMessage({
                  id: "app.garden.settings.nameOwnerOnly",
                  defaultMessage: "Only the garden owner can rename the garden.",
                })
          }
          showCount={canEditName}
          countBytes
          inputProps={{ maxLength: GARDEN_NAME_MAX_LENGTH }}
        />

        <AdminTextArea
          id="garden-settings-description"
          label={formatMessage({
            id: "app.garden.settings.descriptionLabel",
            defaultMessage: "Description",
          })}
          value={draft.description}
          onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
          rows={5}
          disabled={disabledProfileField}
        />

        <AdminTextField
          id="garden-settings-location"
          label={formatMessage({ id: "app.garden.settings.location", defaultMessage: "Location" })}
          value={draft.location}
          onChange={(e) => setDraft((current) => ({ ...current, location: e.target.value }))}
          disabled={disabledProfileField}
        />

        <div className="border-t border-stroke-soft" />

        {/* Banner image — the uploader only. The image itself renders once, on
            the hosting dialog's identity preview card (via onBannerPreviewChange),
            where its Remove/Undo controls also live; a staged file shows here as
            a filename. */}
        <AdminFieldGroup
          as="div"
          label={formatMessage({
            id: "app.garden.create.bannerImageLabel",
            defaultMessage: "Banner image",
          })}
        >
          {draft.bannerFile ? (
            <p className="truncate text-body-sm text-text-sub-600" title={draft.bannerFile.name}>
              {draft.bannerFile.name} ·{" "}
              {formatMessage({
                id: "app.garden.settings.bannerDraft",
                defaultMessage: "Preview · uploads on save",
              })}
            </p>
          ) : null}

          {canEditProfile ? (
            <FileUploadField
              surface="admin"
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
        </AdminFieldGroup>

        <div className="border-t border-stroke-soft" />

        {/* Open joining */}
        <AdminSettingRow
          labelId="garden-settings-open-joining-label"
          label={formatMessage({
            id: "app.garden.settings.openJoining",
            defaultMessage: "Open joining",
          })}
          description={formatMessage({
            id: "app.garden.settings.openJoiningDescription",
            defaultMessage: "Allow anyone to join this garden without an invitation",
          })}
        >
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
        </AdminSettingRow>

        <div className="border-t border-stroke-soft" />

        {/* Limit gardeners — a toggle that reveals the cap field. Off saves 0
            (unlimited); no magic number in the input. */}
        <div className="space-y-3">
          <AdminSettingRow
            labelId="garden-settings-limit-gardeners-label"
            label={formatMessage({
              id: "app.garden.settings.limitGardeners",
              defaultMessage: "Limit gardeners",
            })}
            description={formatMessage({
              id: "app.garden.settings.maxGardenersDescription",
              defaultMessage: "Cap how many gardeners can join. Off means unlimited.",
            })}
          >
            <Switch
              disabled={disabledProfileField}
              checked={draft.limitGardeners}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, limitGardeners: checked === true }))
              }
              surface="admin"
              aria-labelledby="garden-settings-limit-gardeners-label"
              className={cn(disabledProfileField && "cursor-not-allowed opacity-50")}
            />
          </AdminSettingRow>

          {draft.limitGardeners ? (
            <AdminTextField
              id="garden-settings-max-gardeners"
              type="number"
              label={formatMessage({
                id: "app.garden.settings.maxGardeners",
                defaultMessage: "Maximum gardeners",
              })}
              value={draft.maxGardeners}
              onChange={(e) =>
                setDraft((current) => ({ ...current, maxGardeners: e.target.value }))
              }
              disabled={disabledProfileField}
              inputProps={{ min: 1, step: 1, "aria-invalid": maxGardenersInvalid || undefined }}
              className="w-44"
            />
          ) : null}
        </div>

        <div className="border-t border-stroke-soft" />

        {/* Domains — selected inline; saved with the rest on Save changes. */}
        <AdminFieldGroup
          as="div"
          label={formatMessage({ id: "app.garden.detail.domains", defaultMessage: "Domains" })}
          hint={
            canEditProfile
              ? draft.domains.length === 0
                ? formatMessage({
                    id: "app.garden.settings.domainsRequired",
                    defaultMessage: "Select at least one domain",
                  })
                : formatMessage({
                    id: "app.garden.settings.domainsHint",
                    defaultMessage: "Choose what this garden documents.",
                  })
              : undefined
          }
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DOMAIN_OPTIONS.map(
              ({ value, labelId, defaultLabel, descriptionId, defaultDescription }) => (
                <AdminSelectableCard
                  key={value}
                  disabled={disabledProfileField}
                  onClick={() => toggleDomain(value)}
                  selected={draft.domains.includes(value)}
                  title={formatMessage({ id: labelId, defaultMessage: defaultLabel })}
                  description={formatMessage({
                    id: descriptionId,
                    defaultMessage: defaultDescription,
                  })}
                  leadingVisual={
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: DOMAIN_COLORS[value] }}
                    />
                  }
                />
              )
            )}
          </div>
        </AdminFieldGroup>
      </div>
    </section>
  );
});

GardenSettingsEditor.displayName = "GardenSettingsEditor";
