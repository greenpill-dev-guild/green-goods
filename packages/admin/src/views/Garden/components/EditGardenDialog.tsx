import type { useGardenWorkspaceController } from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowGoBackLine, RiCloseLine, RiImageLine } from "@remixicon/react";
import { type ReactNode, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminDialog } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { GardenMetadata } from "@/components/Garden/GardenMetadata";
import {
  type GardenBannerPreview,
  GardenSettingsEditor,
  type GardenSettingsEditorHandle,
  type GardenSettingsFormState,
} from "@/components/Garden/GardenSettingsEditor";
import {
  buildGardenSettingsSaveRows,
  gardenSettingsSaveLine,
} from "@/components/Garden/gardenSettingsSave";
import { TxProgressList } from "@/components/TxProgressList";

type WorkspaceGarden = NonNullable<ReturnType<typeof useGardenWorkspaceController>["garden"]>;

export interface EditGardenDialogProps {
  open: boolean;
  /** Leaves the settings view; the dialog asks first while edits are unsaved. */
  onClose: () => void;
  garden: WorkspaceGarden;
  canManage: boolean;
  isOwner: boolean;
}

const INITIAL_FORM: GardenSettingsFormState = {
  isDirty: false,
  isSaving: false,
  hasValidationError: false,
  dirtyCount: 0,
  canEdit: false,
  run: null,
};

/**
 * Edit Garden, opened by the workspace action of the same name. The form owns
 * the draft and the save; this dialog owns the close guard, the identity
 * preview, and the pinned footer. The footer says how many wallet
 * confirmations a save takes before it starts; once it starts, the body shows
 * each write landing, a stop says where and what was saved, and Try Again
 * sends only the rest (Rule 20).
 */
export function EditGardenDialog({
  open,
  onClose,
  garden,
  canManage,
  isOwner,
}: EditGardenDialogProps) {
  const { formatMessage } = useIntl();
  // The settings form reports its banner draft here so the identity preview
  // card is the single place the image renders (saved, staged, or removed).
  const [bannerPreview, setBannerPreview] = useState<GardenBannerPreview | null>(null);
  // The settings form reports dirtiness, saving, validation, and its save run
  // up so this dialog can guard its close per the dialog contract
  // (confirm-before-discard, hard-block during save) and render the footer.
  const [settingsForm, setSettingsForm] = useState<GardenSettingsFormState>(INITIAL_FORM);
  // Whether the running save is a Try Again, so its footer keeps that button.
  const [retrying, setRetrying] = useState(false);
  const settingsEditorRef = useRef<GardenSettingsEditorHandle>(null);
  // Each opening starts clean: the form remounts and reports afresh, so a save
  // finished last time must not show its footer for a frame.
  const [shownOpen, setShownOpen] = useState(open);
  if (open !== shownOpen) {
    setShownOpen(open);
    if (open) {
      setSettingsForm(INITIAL_FORM);
      setRetrying(false);
    }
  }
  // The dialog closes by navigating, so route mode makes the router blocker
  // the single confirm trigger — X, scrim, Escape, back button, and nav links
  // raise one prompt, never two.
  const settingsDirtyClose = useDirtyClose({
    isDirty: open && settingsForm.isDirty,
    onClose,
    blockRouteChange: true,
  });

  // The identity preview card renders whatever banner the settings form reports
  // (saved, staged draft, or staged removal); before the form mounts, fall back
  // to the saved image so there is no placeholder flash.
  const bannerSrc = bannerPreview ? bannerPreview.src : garden.bannerImage || null;
  const bannerIsDraft = bannerPreview?.isDraft ?? false;
  const bannerRemovalStaged = bannerPreview?.isStagedRemoval ?? false;
  const bannerCanRemove = bannerPreview?.canRemove ?? false;

  const run = settingsForm.run;
  const save = (retry: boolean) => {
    setRetrying(retry);
    void settingsEditorRef.current?.save();
  };

  const buttons = (): ReactNode => {
    if (run?.status === "complete") {
      return (
        <AdminButton
          type="button"
          variant="filled"
          onClick={() => settingsDirtyClose.onOpenChange(false)}
        >
          {formatMessage({ id: "app.common.done", defaultMessage: "Done" })}
        </AdminButton>
      );
    }
    if (run?.status === "stopped" || (run?.status === "running" && retrying)) {
      return (
        <>
          <AdminButton
            type="button"
            variant="text"
            onClick={() => settingsEditorRef.current?.dismissRun()}
            disabled={settingsForm.isSaving}
          >
            {formatMessage({
              id: "app.garden.settings.save.keepEditing",
              defaultMessage: "Keep Editing",
            })}
          </AdminButton>
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => save(true)}
            disabled={!settingsForm.isDirty || settingsForm.isSaving}
            loading={settingsForm.isSaving}
          >
            {formatMessage({ id: "app.common.tryAgain", defaultMessage: "Try Again" })}
          </AdminButton>
        </>
      );
    }
    return (
      <>
        <AdminButton
          type="button"
          variant="text"
          onClick={() => settingsDirtyClose.onOpenChange(false)}
          disabled={settingsForm.isSaving}
        >
          {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        </AdminButton>
        <AdminButton
          type="button"
          variant="filled"
          onClick={() => save(false)}
          disabled={
            !settingsForm.isDirty || settingsForm.hasValidationError || settingsForm.isSaving
          }
          loading={settingsForm.isSaving}
        >
          {formatMessage({ id: "app.garden.settings.saveChanges", defaultMessage: "Save Changes" })}
        </AdminButton>
      </>
    );
  };

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={settingsDirtyClose.onOpenChange}
        preventClose={settingsForm.isSaving}
        size="lg"
        tone="garden"
        title={formatMessage({
          id: "app.garden.profile.modal.title",
          defaultMessage: "Edit Garden",
        })}
        bodyClassName="space-y-6"
        actions={
          settingsForm.canEdit ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={cn(
                  "body-xs",
                  settingsForm.isDirty ? "text-warning-dark" : "text-text-soft"
                )}
                aria-live="polite"
                data-slot="dirty-state"
              >
                {gardenSettingsSaveLine(run, settingsForm.dirtyCount, formatMessage)}
              </p>
              <div className="flex items-center justify-end gap-2">{buttons()}</div>
            </div>
          ) : undefined
        }
      >
        {run ? (
          <TxProgressList
            testId="garden-settings-save"
            chainId={garden.chainId}
            label={formatMessage({
              id: "app.garden.settings.save.listLabel",
              defaultMessage: "What your wallet confirms",
            })}
            rows={buildGardenSettingsSaveRows(run, formatMessage)}
          />
        ) : null}
        {/* The form stays mounted under a save's progress: it owns the draft
            that Keep Editing returns to and Try Again sends. */}
        <div
          className={cn(
            "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]",
            run && "hidden"
          )}
        >
          <GardenSettingsEditor
            ref={settingsEditorRef}
            gardenAddress={garden.id as Address}
            garden={{
              name: garden.name,
              description: garden.description,
              location: garden.location,
              bannerImage: garden.bannerImage,
              domainMask: garden.domainMask,
              openJoining: garden.openJoining,
            }}
            canManage={canManage}
            isOwner={isOwner}
            onBannerPreviewChange={setBannerPreview}
            onDirtyStateChange={setSettingsForm}
          />

          <div className="space-y-4">
            {/* Identity preview — the single place the banner renders (saved,
                staged draft, or staged removal, reported by the form), plus the
                garden name and location. Remove / Undo sit on the image so a
                pending removal is always visible. */}
            <AdminCard variant="filled" density="none" className="overflow-hidden">
              <div className="relative">
                {bannerRemovalStaged ? (
                  <div className="flex h-28 w-full flex-col items-center justify-center gap-1 bg-bg-soft px-3 text-center text-text-soft">
                    <RiImageLine className="h-5 w-5" />
                    <span className="body-xs">
                      {formatMessage({
                        id: "app.garden.settings.bannerWillBeRemoved",
                        defaultMessage: "Will be removed on save",
                      })}
                    </span>
                    <AdminButton
                      type="button"
                      variant="text"
                      size="sm"
                      leadingIcon={<RiArrowGoBackLine />}
                      onClick={() => settingsEditorRef.current?.undoBannerRemoval()}
                    >
                      {formatMessage({ id: "app.common.undo", defaultMessage: "Undo" })}
                    </AdminButton>
                  </div>
                ) : bannerSrc ? (
                  <>
                    <img src={bannerSrc} alt="" className="h-28 w-full object-cover" />
                    {bannerCanRemove ? (
                      <AdminButton
                        type="button"
                        variant="text"
                        size="sm"
                        leadingIcon={<RiCloseLine />}
                        onClick={() => settingsEditorRef.current?.stageBannerRemoval()}
                        className="absolute right-2 top-2 bg-bg-white/90 text-text-sub shadow-[var(--edge-rest)] hover:bg-bg-white"
                      >
                        {formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
                      </AdminButton>
                    ) : null}
                    {bannerIsDraft ? (
                      <span className="absolute bottom-2 right-2 rounded-full bg-bg-white/90 px-2 py-0.5 text-label-sm font-medium text-text-sub shadow-[var(--edge-rest)]">
                        {formatMessage({
                          id: "app.garden.settings.bannerDraft",
                          defaultMessage: "Preview · uploads on save",
                        })}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-bg-soft text-text-soft">
                    <RiImageLine className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3 body-sm text-text-sub">
                <h3 className="label-md truncate text-text-strong" title={garden.name}>
                  {garden.name}
                </h3>
                {garden.location ? (
                  <p className="truncate" title={garden.location}>
                    {garden.location}
                  </p>
                ) : null}
              </div>
            </AdminCard>

            {/* On-chain identifiers fill the column beside the form instead of
                dangling below the grid. */}
            <GardenMetadata
              gardenId={garden.id as Address}
              tokenAddress={garden.tokenAddress as Address}
              tokenId={BigInt(garden.tokenID)}
              chainId={garden.chainId}
            />
          </div>
        </div>
      </AdminDialog>
      <DiscardChangesDialog
        open={settingsDirtyClose.confirmOpen}
        onKeepEditing={settingsDirtyClose.cancelClose}
        onDiscard={settingsDirtyClose.confirmClose}
        tone="garden"
      />
    </>
  );
}
