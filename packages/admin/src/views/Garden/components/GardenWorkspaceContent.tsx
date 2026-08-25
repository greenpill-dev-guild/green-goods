import type { useGardenWorkspaceController } from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { AdminCard } from "@/components/AdminCard";
import { RiArrowGoBackLine, RiCloseLine, RiImageLine } from "@remixicon/react";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
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
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "@/components/Layout/CanvasRouteState";
import { OverviewTab } from "./OverviewTab";
import { ImpactTab } from "./ImpactTab";
import { GardenPoolTab } from "../Pool";

interface GardenWorkspaceContentProps {
  workspace: ReturnType<typeof useGardenWorkspaceController>;
}

export function GardenWorkspaceContent({ workspace }: GardenWorkspaceContentProps) {
  const { formatMessage } = useIntl();
  // The settings form reports its banner draft here so the identity preview
  // card is the single place the image renders (saved, staged, or removed).
  const [bannerPreview, setBannerPreview] = useState<GardenBannerPreview | null>(null);
  // The settings form reports dirtiness/saving/validation up so this dialog
  // can guard its close per the dialog contract (confirm-before-discard,
  // hard-block during save) and render the pinned footer. Gated on the
  // settings view so a stale report can't block later navigation after the
  // dialog is gone.
  const [settingsForm, setSettingsForm] = useState<GardenSettingsFormState>({
    isDirty: false,
    isSaving: false,
    hasValidationError: false,
    dirtyCount: 0,
    canEdit: false,
  });
  // Drives the footer's Save/Cancel — the form owns the draft, the dialog owns
  // the pinned actions bar.
  const settingsEditorRef = useRef<GardenSettingsEditorHandle>(null);
  const settingsOpen = workspace.settingsOpen;
  // The dialog closes by navigating (handleTabChange → navigate), so route
  // mode makes the router blocker the single confirm trigger — X, scrim,
  // Escape, back button, and nav links raise one prompt, never two.
  const settingsDirtyClose = useDirtyClose({
    isDirty: settingsOpen && settingsForm.isDirty,
    onClose: workspace.handleSettingsClose,
    blockRouteChange: true,
  });

  if (!workspace.selectedGarden) {
    return (
      <CanvasWorkspaceSelectionGate
        workspaceLabel={formatMessage({ id: "cockpit.nav.garden", defaultMessage: "Garden" })}
        gardens={workspace.gardenOptions}
        onSelectGarden={workspace.handleSelectGarden}
      />
    );
  }

  if (workspace.fetching) {
    return <CanvasWorkspaceLoadingState />;
  }

  if (!workspace.garden || workspace.error) {
    return (
      <CanvasRouteErrorState
        message={
          workspace.error?.message ??
          formatMessage({
            id: "cockpit.garden.loadFailedDescription",
            defaultMessage: "Try choosing a different garden or refreshing the page.",
          })
        }
      />
    );
  }

  // The identity preview card renders whatever banner the settings form reports
  // (saved, staged draft, or staged removal); before the form mounts, fall back
  // to the saved image so there is no placeholder flash.
  const bannerSrc = bannerPreview ? bannerPreview.src : workspace.garden.bannerImage || null;
  const bannerIsDraft = bannerPreview?.isDraft ?? false;
  const bannerRemovalStaged = bannerPreview?.isStagedRemoval ?? false;
  const bannerCanRemove = bannerPreview?.canRemove ?? false;

  return (
    <div className="mt-4 min-h-0 flex-1 space-y-4">
      {workspace.view === "health" || workspace.view === "activity" ? (
        <OverviewTab
          mode={workspace.view}
          section={workspace.section}
          selectedItem={workspace.selectedItem}
          selectedRange={workspace.range}
          clearSection={workspace.clearSection}
          openSection={workspace.openSection}
          updateQueryState={workspace.updateOverviewQueryState}
          overviewAlerts={workspace.derived.overviewAlerts}
          gardenHealthLabel={workspace.derived.gardenHealthLabel}
          approvedInRangeCount={workspace.derived.approvedInRangeCount}
          impactVelocityDelta={workspace.derived.impactVelocityDelta}
          medianReviewAgeHours={workspace.derived.medianReviewAgeHours}
          activityFilter={workspace.activityFilter}
          setActivityFilter={workspace.setActivityFilter}
          filteredActivityEvents={workspace.canvasActivityEvents}
          isLoading={workspace.fetching}
          pendingWorkCount={workspace.derived.pendingWorks.length}
          assessmentCount30d={workspace.assessments.length}
          gardenerCount={workspace.garden.gardeners.length}
          treasuryBalance={workspace.treasuryBalance}
        />
      ) : null}

      {workspace.view === "pool" ? (
        <GardenPoolTab
          garden={{ id: workspace.garden.id as Address, name: workspace.garden.name }}
          chainId={workspace.garden.chainId}
          canManage={workspace.canManage}
        />
      ) : null}

      {workspace.view === "impact" ? (
        <ImpactTab
          garden={workspace.garden}
          gardenId={workspace.garden.id}
          canManage={false}
          canReview={workspace.canReview}
          section={workspace.section}
          selectedItem={workspace.selectedItem}
          clearSection={workspace.clearSection}
          openSection={workspace.openSection}
          assessments={workspace.assessments}
          fetchingAssessments={workspace.fetchingAssessments}
          assessmentsError={workspace.assessmentsError}
          hypercerts={workspace.hypercerts}
          hypercertsLoading={workspace.hypercertsLoading}
          domainLabels={workspace.derived.domainLabels}
          approvedInLastThirtyDays={workspace.derived.approvedInLastThirtyDays}
        />
      ) : null}

      {/* Garden settings live in a centered dialog (parity with the other
          action flows), opened by the "Edit garden" action and
          rendered over the Overview behind it. Deep-linking to /garden/settings
          opens it directly; closing returns to Health. */}
      <AdminDialog
        open={settingsOpen}
        onOpenChange={settingsDirtyClose.onOpenChange}
        preventClose={settingsForm.isSaving}
        size="lg"
        tone="garden"
        title={formatMessage({
          id: "app.garden.profile.modal.title",
          defaultMessage: "Garden Profile",
        })}
        description={formatMessage({
          id: "app.garden.profile.modal.description",
          defaultMessage: "Update settings, metadata, and on-chain identifiers",
        })}
        bodyClassName="space-y-6"
        actions={
          settingsForm.canEdit ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={cn(
                  "text-xs",
                  settingsForm.isDirty ? "text-warning-dark" : "text-text-soft"
                )}
                aria-live="polite"
                data-slot="dirty-state"
              >
                {settingsForm.isSaving
                  ? formatMessage({
                      id: "app.garden.settings.saving",
                      defaultMessage: "Saving changes…",
                    })
                  : settingsForm.isDirty
                    ? formatMessage(
                        {
                          id: "app.garden.settings.unsavedChanges",
                          defaultMessage:
                            "{count, plural, one {# unsaved change} other {# unsaved changes}}",
                        },
                        { count: settingsForm.dirtyCount }
                      )
                    : formatMessage({
                        id: "app.garden.settings.allSaved",
                        defaultMessage: "All changes saved",
                      })}
              </p>
              <div className="flex items-center justify-end gap-2">
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
                  onClick={() => void settingsEditorRef.current?.save()}
                  disabled={
                    !settingsForm.isDirty ||
                    settingsForm.hasValidationError ||
                    settingsForm.isSaving
                  }
                  loading={settingsForm.isSaving}
                >
                  {formatMessage({
                    id: "app.garden.settings.saveChanges",
                    defaultMessage: "Save changes",
                  })}
                </AdminButton>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <GardenSettingsEditor
            ref={settingsEditorRef}
            gardenAddress={workspace.garden.id as Address}
            garden={{
              name: workspace.garden.name,
              description: workspace.garden.description,
              location: workspace.garden.location,
              bannerImage: workspace.garden.bannerImage,
              domainMask: workspace.garden.domainMask,
              openJoining: workspace.garden.openJoining,
            }}
            canManage={workspace.canManage}
            isOwner={workspace.isOwner}
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
                    <span className="text-xs">
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
              <div className="space-y-1 p-3 text-sm text-text-sub">
                <h3 className="label-md truncate text-text-strong" title={workspace.garden.name}>
                  {workspace.garden.name}
                </h3>
                {workspace.garden.location ? (
                  <p className="truncate" title={workspace.garden.location}>
                    {workspace.garden.location}
                  </p>
                ) : null}
              </div>
            </AdminCard>

            {/* On-chain identifiers fill the column beside the form instead of
                dangling below the grid. */}
            <GardenMetadata
              gardenId={workspace.garden.id as Address}
              tokenAddress={workspace.garden.tokenAddress as Address}
              tokenId={BigInt(workspace.garden.tokenID)}
              chainId={workspace.garden.chainId}
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
    </div>
  );
}
