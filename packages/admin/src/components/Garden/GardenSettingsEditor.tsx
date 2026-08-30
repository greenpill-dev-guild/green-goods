import { FileUploadField } from "@green-goods/shared/components/FileUploadField";
import { Switch } from "@green-goods/shared/components/Form/ControlPrimitives";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { GARDEN_NAME_MAX_LENGTH } from "@green-goods/shared/hooks/garden/useCreateGardenForm";
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
import { type Address, DOMAIN_COLORS, Domain } from "@green-goods/shared/types/domain";
import { expandDomainMask } from "@green-goods/shared/utils/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { imageCompressor } from "@green-goods/shared/utils/work/image-compression";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminFieldGroup } from "@/components/AdminFieldGroup";
import { AdminSelectableCard } from "@/components/AdminSelectableCard";
import { AdminSettingRow } from "@/components/AdminSettingRow";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";

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
  /** Count of edited fields — feeds the footer's unsaved-changes line. */
  dirtyCount: number;
  /** Whether the steward can edit anything — hides the footer when false. */
  canEdit: boolean;
}

/** Imperative surface for the hosting dialog's footer + banner preview card. */
export interface GardenSettingsEditorHandle {
  /** Save the dirty fields (no-op when pristine, invalid, or already saving). */
  save: () => Promise<void>;
  /** Stage the saved banner for removal (host preview card's Remove control). */
  stageBannerRemoval: () => void;
  /** Undo a staged banner removal (host preview card's Undo control). */
  undoBannerRemoval: () => void;
}

interface GardenSettingsEditorProps {
  gardenAddress: Address;
  garden: {
    name: string;
    description: string;
    location: string;
    bannerImage: string;
    domainMask?: number;
    openJoining?: boolean;
    maxGardeners?: number;
  };
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

/** The four action domains a garden can document. Selected inline in the
 * settings draft and written on Save via `useSetGardenDomains`. */
const DOMAIN_OPTIONS = [
  {
    value: Domain.SOLAR,
    labelId: "app.garden.create.domain.solar",
    defaultLabel: "Solar",
    descriptionId: "app.garden.create.domain.solar.description",
    defaultDescription: "Track solar panel installations, kWh generated, and maintenance",
  },
  {
    value: Domain.AGRO,
    labelId: "app.garden.create.domain.agro",
    defaultLabel: "Agroforestry",
    descriptionId: "app.garden.create.domain.agro.description",
    defaultDescription: "Document tree planting, harvests, and land stewardship",
  },
  {
    value: Domain.EDU,
    labelId: "app.garden.create.domain.edu",
    defaultLabel: "Education",
    descriptionId: "app.garden.create.domain.edu.description",
    defaultDescription: "Record workshops, trainings, and knowledge sharing",
  },
  {
    value: Domain.WASTE,
    labelId: "app.garden.create.domain.waste",
    defaultLabel: "Waste",
    descriptionId: "app.garden.create.domain.waste.description",
    defaultDescription: "Log waste collection, recycling, and composting activities",
  },
] as const;

interface SettingsDraft {
  name: string;
  description: string;
  location: string;
  openJoining: boolean;
  /** Whether a gardener cap applies — off means unlimited (saves 0). */
  limitGardeners: boolean;
  /** The cap as a string while editing (only meaningful when limited). */
  maxGardeners: string;
  domains: Domain[];
  /** Locally selected banner file — uploads to IPFS only on Save. */
  bannerFile: File | null;
  /** Marks the saved banner for removal on Save. */
  bannerRemoved: boolean;
}

function draftFromGarden(garden: GardenSettingsEditorProps["garden"]): SettingsDraft {
  const max = garden.maxGardeners ?? 0;
  return {
    name: garden.name,
    description: garden.description,
    location: garden.location,
    openJoining: !!garden.openJoining,
    limitGardeners: max > 0,
    maxGardeners: max > 0 ? String(max) : "",
    domains: expandDomainMask(garden.domainMask ?? 0),
    bannerFile: null,
    bannerRemoved: false,
  };
}

function sameDomains(a: Domain[], b: Domain[]): boolean {
  return a.length === b.length && a.every((domain) => b.includes(domain));
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
  const baseline = draftFromGarden(garden);
  const baselineMax = Number(garden.maxGardeners ?? 0);
  const effectiveMax = draft.limitGardeners ? Number(draft.maxGardeners) : 0;

  const dirtyFields: string[] = [];
  if (draft.name.trim() !== baseline.name) dirtyFields.push("name");
  if (draft.description.trim() !== baseline.description) dirtyFields.push("description");
  if (draft.location.trim() !== baseline.location) dirtyFields.push("location");
  if (draft.openJoining !== baseline.openJoining) dirtyFields.push("openJoining");
  if (effectiveMax !== baselineMax) dirtyFields.push("maxGardeners");
  if (!sameDomains(draft.domains, baseline.domains)) dirtyFields.push("domains");
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
  const maxGardenersInvalid =
    draft.limitGardeners &&
    (draft.maxGardeners.trim() === "" ||
      !Number.isInteger(Number(draft.maxGardeners)) ||
      Number(draft.maxGardeners) < 1);
  // Unreachable via the min-one toggle guard, but keeps Save honest if a garden
  // ever reaches an empty selection through some other path.
  const domainsInvalid = dirtyFields.includes("domains") && draft.domains.length === 0;
  const hasValidationError = nameInvalid || maxGardenersInvalid || domainsInvalid;

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

  const dirtyCount = dirtyFields.length;

  useEffect(() => {
    onDirtyStateChange?.({
      isDirty,
      isSaving,
      hasValidationError,
      dirtyCount,
      canEdit: canEditAnything,
    });
  }, [isDirty, isSaving, hasValidationError, dirtyCount, canEditAnything, onDirtyStateChange]);

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
        await setMaxGardeners.mutateAsync({ gardenAddress, value: effectiveMax });
      }
      if (dirtyFields.includes("domains")) {
        await setGardenDomains.mutateAsync({ gardenAddress, domains: draft.domains });
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
        <div>
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
            inputProps={{ maxLength: GARDEN_NAME_MAX_LENGTH }}
          />
          <p
            className={cn(
              "mt-1 text-right label-xs tabular-nums",
              draft.name.length > GARDEN_NAME_MAX_LENGTH * 0.85
                ? "text-warning-dark"
                : "text-text-soft"
            )}
          >
            {draft.name.length}/{GARDEN_NAME_MAX_LENGTH}
          </p>
        </div>

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
