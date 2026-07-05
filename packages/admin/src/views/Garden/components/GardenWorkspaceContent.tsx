import {
  type Address,
  cn,
  EmptyState,
  type AdminWorkspaceSectionTab,
  useDirtyClose,
  type useGardenWorkspaceController,
} from "@green-goods/shared";
import { AdminCard } from "@/components/AdminCard";
import { RiCupLine, RiImageLine, RiPulseLine } from "@remixicon/react";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { GardenDomainModal } from "@/components/Garden/GardenDomainEditor";
import { GardenMetadata } from "@/components/Garden/GardenMetadata";
import {
  type GardenBannerPreview,
  GardenSettingsEditor,
  type GardenSettingsEditorHandle,
  type GardenSettingsFormState,
} from "@/components/Garden/GardenSettingsEditor";
import { CookieJarManageModal } from "@/views/Hub/components/CookieJarManageModal";
import {
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "@/components/Layout/CanvasRouteState";
import { OverviewTab } from "./OverviewTab";
import { GardenDomainSummaryRow } from "./GardenDetailHelpers";

interface GardenWorkspaceContentProps {
  workspace: ReturnType<typeof useGardenWorkspaceController>;
}

export function GardenWorkspaceContent({ workspace }: GardenWorkspaceContentProps) {
  const { formatMessage } = useIntl();
  // The settings form reports its banner draft here so the identity preview
  // card is the single place the image renders (saved, staged, or removed).
  const [bannerPreview, setBannerPreview] = useState<GardenBannerPreview | null>(null);
  // Jar management is garden configuration — it opens from this dialog
  // (moved off the Community payout surface, which keeps deposits/withdrawals).
  const [cookieJarsOpen, setCookieJarsOpen] = useState(false);
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
  const settingsOpen = workspace.view === "settings";
  // The dialog closes by navigating (handleTabChange → navigate), so route
  // mode makes the router blocker the single confirm trigger — X, scrim,
  // Escape, back button, and nav links raise one prompt, never two.
  const settingsDirtyClose = useDirtyClose({
    isDirty: settingsOpen && settingsForm.isDirty,
    onClose: () => workspace.handleTabChange("overview"),
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

  return (
    <div className="mt-4 space-y-4">
      {workspace.view === "overview" || workspace.view === "settings" ? (
        <OverviewTab
          section={workspace.section}
          selectedItem={workspace.selectedItem}
          selectedRange={workspace.range}
          clearSection={workspace.clearSection}
          openSection={workspace.openSection}
          updateQueryState={workspace.updateOverviewQueryState}
          setTab={(tab) =>
            workspace.openSection(
              tab as AdminWorkspaceSectionTab,
              tab === "community" ? "treasury" : "queue"
            )
          }
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

      {workspace.view === "activity" ? (
        <EmptyState
          icon={<RiPulseLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.garden.activity.empty.title",
            defaultMessage: "Activity feed coming soon",
          })}
          description={formatMessage({
            id: "cockpit.garden.activity.empty.description",
            defaultMessage:
              "Submitted Work, plot updates, plantings, and milestones will surface here as the gardener-floor of this Garden.",
          })}
        />
      ) : null}

      {/* Garden settings live in a centered dialog (parity with the other
          action flows), opened by the Settings tab / "Edit garden" action and
          rendered over the Overview behind it. Deep-linking to /garden/settings
          opens it directly; closing returns to the Overview. */}
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
                  onClick={() => settingsEditorRef.current?.cancel()}
                  disabled={!settingsForm.isDirty || settingsForm.isSaving}
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
              openJoining: workspace.garden.openJoining,
              maxGardeners: workspace.garden.maxGardeners,
            }}
            canManage={workspace.canManage}
            isOwner={workspace.isOwner}
            onBannerPreviewChange={setBannerPreview}
            onDirtyStateChange={setSettingsForm}
          />

          <div className="space-y-4">
            {/* Identity preview — the single place the banner renders (saved
                or staged draft, reported by the form), plus name/location. */}
            <AdminCard variant="filled" density="none" className="overflow-hidden">
              <div className="relative">
                {(bannerPreview ? bannerPreview.src : workspace.garden.bannerImage) ? (
                  <img
                    src={(bannerPreview ? bannerPreview.src : workspace.garden.bannerImage) ?? ""}
                    alt=""
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-bg-soft text-text-soft">
                    <RiImageLine className="h-6 w-6" />
                  </div>
                )}
                {bannerPreview?.isDraft ? (
                  <span className="absolute bottom-2 right-2 rounded-full bg-bg-white/90 px-2 py-0.5 text-[11px] font-medium text-text-sub shadow-[var(--edge-rest)]">
                    {formatMessage({
                      id: "app.garden.settings.bannerDraft",
                      defaultMessage: "Preview · uploads on save",
                    })}
                  </span>
                ) : null}
              </div>
              <div className="space-y-1 p-3 text-sm text-text-sub">
                <h3 className="label-md text-text-strong">{workspace.garden.name}</h3>
                {workspace.garden.location ? <p>{workspace.garden.location}</p> : null}
                {workspace.community ? (
                  <p>
                    {formatMessage({
                      id: "cockpit.garden.communityConnected",
                      defaultMessage: "Community connected",
                    })}
                  </p>
                ) : null}
              </div>
            </AdminCard>

            {/* Domain management lives inside the settings dialog (QA: the
                edit-domains row no longer floats above every garden tab). */}
            <AdminCard variant="filled" density="none" className="overflow-hidden">
              <GardenDomainSummaryRow
                domainMask={workspace.garden.domainMask}
                canManage={workspace.canManage}
                onEditDomains={workspace.openDomainEditor}
              />
            </AdminCard>

            {workspace.canManage ? (
              <AdminCard variant="filled" density="none" className="overflow-hidden">
                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="label-xs text-text-soft">
                      {formatMessage({
                        id: "app.cookieJar.settingsRow.label",
                        defaultMessage: "Cookie jars",
                      })}
                    </p>
                    <p className="text-xs text-text-sub">
                      {formatMessage({
                        id: "app.cookieJar.settingsRow.description",
                        defaultMessage: "Pause state, withdrawal limits, and cooldowns",
                      })}
                    </p>
                  </div>
                  <AdminButton
                    type="button"
                    variant="tonal"
                    size="sm"
                    leadingIcon={<RiCupLine />}
                    onClick={() => setCookieJarsOpen(true)}
                  >
                    {formatMessage({
                      id: "app.cookieJar.manageJars",
                      defaultMessage: "Manage Jars",
                    })}
                  </AdminButton>
                </div>
              </AdminCard>
            ) : null}

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
      {workspace.canManage ? (
        <GardenDomainModal
          isOpen={workspace.domainEditorOpen}
          onClose={workspace.closeDomainEditor}
          gardenAddress={workspace.garden.id as Address}
        />
      ) : null}
      {workspace.canManage ? (
        <CookieJarManageModal
          isOpen={cookieJarsOpen}
          onClose={() => setCookieJarsOpen(false)}
          gardenAddress={workspace.garden.id as Address}
          canManage={workspace.canManage}
          isOwner={workspace.isOwner}
        />
      ) : null}
    </div>
  );
}
