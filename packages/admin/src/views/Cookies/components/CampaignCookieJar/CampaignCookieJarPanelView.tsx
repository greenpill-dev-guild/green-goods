import { RiExternalLinkLine, RiRefreshLine } from "@remixicon/react";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminDialog } from "@/components/AdminDialog";
import { EnsAddressText } from "@/components/EnsAddressText";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { CampaignImageInput } from "./CampaignImageInput";
import { GardenSelector } from "./GardenSelector";
import { publicJarLink } from "./helpers";
import { CampaignCookieJarPanelList } from "./CampaignCookieJarPanelList";
import type { CampaignCookieJarPanelViewProps } from "./CampaignCookieJarPanelView.types";

export function CampaignCookieJarPanelView(props: CampaignCookieJarPanelViewProps) {
  const {
    formatMessage,
    moduleConfigured,
    isDeployer,
    roleLoading,
    campaigns,
    campaignsLoading,
    campaignsError,
    campaignSearch,
    setCampaignSearch,
    visibleCampaigns,
    gardensByAddress,
    setSelectedCampaign,
    selectedCampaign,
    selectedCampaignTitle,
    selectedCampaignPublicUrl,
    syncAllowlist,
    updateMetadata,
    canSync,
    handleSync,
    syncCampaignDescription,
    setSyncCampaignDescription,
    syncCampaignImage,
    setSyncCampaignImage,
    syncCampaignImageFile,
    setSyncCampaignImageFile,
    gardens,
    syncGardenIds,
    setSyncGardenIds,
    toggleSyncGarden,
    selectSyncGardens,
    syncGardenSearch,
    setSyncGardenSearch,
    syncExtraAddresses,
    setSyncExtraAddresses,
    syncAggregation,
    syncDiff,
    selectedJarAddress,
    syncJar,
  } = props;
  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col gap-5">
      {!moduleConfigured ? (
        <AdminCard
          variant="outlined"
          className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]"
        >
          {formatMessage({
            id: "cockpit.community.cookies.factoryMissing",
            defaultMessage: "Cookie Jar factory discovery is not configured on this network yet.",
          })}
        </AdminCard>
      ) : null}
      {!isDeployer && !roleLoading ? (
        <AdminCard
          variant="outlined"
          className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]"
        >
          {formatMessage({
            id: "cockpit.community.cookies.deployerOnly",
            defaultMessage:
              "This surface is intended for deployer and ops wallets. Connect a deployer wallet to create and manage campaign cookie jars.",
          })}
        </AdminCard>
      ) : null}
      <CampaignCookieJarPanelList
        formatMessage={formatMessage}
        campaigns={campaigns}
        campaignsLoading={campaignsLoading}
        campaignsError={campaignsError}
        campaignSearch={campaignSearch}
        setCampaignSearch={setCampaignSearch}
        visibleCampaigns={visibleCampaigns}
        gardensByAddress={gardensByAddress}
        onSelectCampaign={setSelectedCampaign}
      />
      <AdminDialog
        open={Boolean(selectedCampaign)}
        onOpenChange={(open) => {
          if (!open) setSelectedCampaign(null);
        }}
        title={formatMessage(
          {
            id: "cockpit.community.cookies.manageTitle",
            defaultMessage: "Manage {title}",
          },
          { title: selectedCampaignTitle }
        )}
        description={formatMessage({
          id: "cockpit.community.cookies.manageDescription",
          defaultMessage:
            "Review the public link, update campaign metadata, and sync garden steward access.",
        })}
        size="lg"
        tone="community"
        preventClose={syncAllowlist.isPending || updateMetadata.isPending}
        actions={
          <>
            {/* Disabled while a write is in flight: the sync/metadata hooks
                report errors inline, so a Cancel-close mid-write would render
                the failure into a dialog nobody can see. */}
            <AdminButton
              type="button"
              variant="text"
              onClick={() => setSelectedCampaign(null)}
              disabled={syncAllowlist.isPending || updateMetadata.isPending}
            >
              {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              leadingIcon={<RiRefreshLine />}
              onClick={handleSync}
              disabled={!canSync || syncAllowlist.isPending || updateMetadata.isPending}
              loading={syncAllowlist.isPending || updateMetadata.isPending}
            >
              {formatMessage({
                id: "cockpit.community.cookies.sync",
                defaultMessage: "Sync Allowlist",
              })}
            </AdminButton>
          </>
        }
      >
        {selectedCampaign ? (
          <div className="space-y-5">
            <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] p-3">
              <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.jarAddress",
                  defaultMessage: "Jar address",
                })}
              </p>
              <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                <EnsAddressText address={selectedCampaign.address} />
              </p>
              <a
                href={publicJarLink(selectedCampaign.address)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-label-md text-[rgb(var(--m3-primary))] underline-offset-4 hover:underline"
              >
                {formatMessage({
                  id: "cockpit.community.cookies.openPublicLink",
                  defaultMessage: "Open Public Link",
                })}
                <RiExternalLinkLine className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={formatMessage({
                  id: "cockpit.community.cookies.campaignDescription",
                  defaultMessage: "Campaign description",
                })}
                htmlFor="campaign-cookie-jar-manage-description"
                className="md:col-span-2"
              >
                <Textarea
                  id="campaign-cookie-jar-manage-description"
                  surface="admin"
                  value={syncCampaignDescription}
                  onChange={(event) => setSyncCampaignDescription(event.target.value)}
                />
              </FormField>
              <CampaignImageInput
                value={syncCampaignImage}
                onChange={setSyncCampaignImage}
                file={syncCampaignImageFile}
                onFileChange={setSyncCampaignImageFile}
                disabled={syncAllowlist.isPending || updateMetadata.isPending}
                source="campaign-cookie-jar-manage-image"
              />
              <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-3">
                <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
                  {formatMessage({
                    id: "cockpit.community.cookies.generatedCampaignLink",
                    defaultMessage: "Campaign page",
                  })}
                </p>
                <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                  {selectedCampaignPublicUrl}
                </p>
              </div>
            </div>
            <GardenSelector
              gardens={gardens}
              selectedGardenIds={syncGardenIds}
              onToggle={toggleSyncGarden}
              onSelectMany={selectSyncGardens}
              onClear={() => setSyncGardenIds([])}
              search={syncGardenSearch}
              setSearch={setSyncGardenSearch}
            />
            <FormField
              label={formatMessage({
                id: "cockpit.community.cookies.extraAddresses",
                defaultMessage: "Extra allowlist addresses",
              })}
              htmlFor="campaign-cookie-jar-manage-extra-addresses"
            >
              <Textarea
                id="campaign-cookie-jar-manage-extra-addresses"
                surface="admin"
                value={syncExtraAddresses}
                onChange={(event) => setSyncExtraAddresses(event.target.value)}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-3">
              <DiffStat
                label={formatMessage({
                  id: "cockpit.community.cookies.desired",
                  defaultMessage: "Desired",
                })}
                value={syncAggregation.allowlist.length}
              />
              <DiffStat
                label={formatMessage({
                  id: "cockpit.community.cookies.grant",
                  defaultMessage: "Grant",
                })}
                value={syncDiff.grant.length}
              />
              <DiffStat
                label={formatMessage({
                  id: "cockpit.community.cookies.revoke",
                  defaultMessage: "Revoke",
                })}
                value={syncDiff.revoke.length}
              />
            </div>
            {syncAggregation.invalidAddresses.length > 0 ? (
              <p className="text-body-sm text-[rgb(var(--m3-error))]">
                {formatMessage(
                  {
                    id: "cockpit.community.cookies.invalidExtras",
                    defaultMessage: "Invalid addresses: {addresses}",
                  },
                  { addresses: syncAggregation.invalidAddresses.join(", ") }
                )}
              </p>
            ) : null}
            {selectedJarAddress && syncJar.jar && !syncJar.jar.isOwner ? (
              <p className="text-body-sm text-[rgb(var(--m3-error))]">
                {formatMessage({
                  id: "cockpit.community.cookies.jarOwnerRequired",
                  defaultMessage:
                    "Connect the jar owner or ops Safe to grant, revoke, and update campaign metadata.",
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
function DiffStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] px-3 py-2">
      <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">{label}</p>
      <p className="mt-1 text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">{value}</p>
    </div>
  );
}
