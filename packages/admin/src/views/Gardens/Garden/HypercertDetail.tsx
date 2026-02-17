import {
  DEFAULT_CHAIN_ID,
  formatDate,
  getNetworkConfig,
  ImageWithFallback,
  useGardens,
  useHypercerts,
  useHypercertListings,
  useGardenPermissions,
  type OptimisticHypercertData,
} from "@green-goods/shared";
import {
  RiExternalLinkLine,
  RiLoader4Line,
  RiCheckLine,
  RiExchangeDollarLine,
} from "@remixicon/react";
import { useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useIntl } from "react-intl";
import type { Address } from "viem";
import { formatEther } from "viem";
import { PageHeader } from "@/components/Layout/PageHeader";
import { MarketplaceApprovalGate } from "@/components/hypercerts/MarketplaceApprovalGate";
import { CreateListingDialog } from "@/components/hypercerts/CreateListingDialog";
import { TradeHistoryTable } from "@/components/hypercerts/TradeHistoryTable";

const HYPERCERTS_APP_BASE_URL = "https://app.hypercerts.org/hypercerts";

function buildHypercertUrl(hypercertId: string) {
  return `${HYPERCERTS_APP_BASE_URL}/${hypercertId}`;
}

/**
 * Sync status indicator component.
 * Shows visual feedback about data freshness after minting.
 */
function SyncStatusIndicator({
  status,
  formatMessage,
}: {
  status: "synced" | "syncing" | "optimistic" | "failed";
  formatMessage: (descriptor: { id: string }) => string;
}) {
  if (status === "synced") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-success-lighter px-3 py-1 text-xs font-medium text-success-dark">
        <RiCheckLine className="h-3.5 w-3.5" />
        {formatMessage({ id: "app.hypercerts.detail.synced" })}
      </div>
    );
  }

  if (status === "syncing") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-warning-lighter px-3 py-1 text-xs font-medium text-warning-dark">
        <RiLoader4Line className="h-3.5 w-3.5 animate-spin" />
        {formatMessage({ id: "app.hypercerts.detail.syncing" })}
      </div>
    );
  }

  if (status === "optimistic") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-info-lighter px-3 py-1 text-xs font-medium text-info-dark">
        {formatMessage({ id: "app.hypercerts.detail.optimistic" })}
      </div>
    );
  }

  return null;
}

export default function HypercertDetail() {
  const { id, hypercertId } = useParams<{ id: string; hypercertId: string }>();
  const { formatMessage } = useIntl();
  const location = useLocation();
  const { data: gardens = [] } = useGardens();
  const garden = gardens.find((item) => item.id === id);
  const permissions = useGardenPermissions();
  const canManage = garden ? permissions.canManageGarden(garden) : false;
  const [listingDialogOpen, setListingDialogOpen] = useState(false);

  // Extract optimistic data from navigation state (passed after minting)
  const locationState = location.state as { optimisticData?: OptimisticHypercertData } | null;
  const optimisticData = locationState?.optimisticData;

  const { hypercert, isLoading, syncStatus } = useHypercerts({
    hypercertId,
    gardenId: garden?.id,
    optimisticData,
  });
  const explorer = getNetworkConfig(garden?.chainId ?? DEFAULT_CHAIN_ID).blockExplorer;

  // Show sync indicator only when we came from minting flow (have optimistic data)
  const showSyncStatus = Boolean(optimisticData);

  if (!garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.hypercerts.detail.title" })}
          description={formatMessage({ id: "app.hypercerts.detail.notFound" })}
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.hypercerts.backToGardens" }),
          }}
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.hypercerts.detail.title" })}
        description={formatMessage(
          { id: "app.hypercerts.detail.description" },
          { gardenName: garden.name }
        )}
        backLink={{
          to: `/gardens/${garden.id}/hypercerts`,
          label: formatMessage({ id: "app.hypercerts.backToHypercerts" }),
        }}
        sticky
      />

      <div className="mx-auto mt-6 max-w-5xl space-y-6 px-4 sm:px-6">
        {isLoading && (
          <div className="space-y-6">
            <div className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-6">
              <div className="flex justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-6 w-64 rounded bg-bg-soft" />
                  <div className="h-4 w-full max-w-md rounded bg-bg-soft" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-32 rounded bg-bg-soft" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="h-4 w-24 rounded bg-bg-soft" />
                <div className="h-4 w-20 rounded bg-bg-soft" />
                <div className="h-4 w-28 rounded bg-bg-soft" />
              </div>
            </div>
            <div className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-6">
              <div className="h-5 w-32 rounded bg-bg-soft" />
              <div className="mt-3 aspect-square max-w-xs rounded-lg bg-bg-soft" />
            </div>
          </div>
        )}

        {!isLoading && !hypercert && (
          <div className="rounded-lg border border-error-light bg-error-lighter p-6 text-sm text-error-dark">
            {formatMessage({ id: "app.hypercerts.detail.missing" })}
          </div>
        )}

        {!isLoading && hypercert && (
          <div className="space-y-6">
            {/* Sync status banner for newly minted hypercerts */}
            {showSyncStatus && syncStatus !== "synced" && (
              <div className="rounded-lg border border-info-light bg-info-lighter p-4">
                <div className="flex items-center gap-3">
                  <RiLoader4Line className="h-5 w-5 animate-spin text-info-dark" />
                  <div>
                    <p className="text-sm font-medium text-info-dark">
                      {formatMessage({ id: "app.hypercerts.detail.syncingBanner.title" })}
                    </p>
                    <p className="mt-0.5 text-xs text-info-dark/80">
                      {formatMessage({ id: "app.hypercerts.detail.syncingBanner.message" })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-text-strong">
                      {hypercert.title ||
                        formatMessage({ id: "app.hypercerts.detail.fallbackTitle" })}
                    </h2>
                    {showSyncStatus && (
                      <SyncStatusIndicator status={syncStatus} formatMessage={formatMessage} />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-sub">
                    {hypercert.description ||
                      formatMessage({ id: "app.hypercerts.detail.fallbackDescription" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={buildHypercertUrl(hypercert.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-stroke-sub px-3 py-2 text-xs font-medium text-text-sub transition hover:bg-bg-weak"
                  >
                    <RiExternalLinkLine className="h-4 w-4" />
                    {formatMessage({ id: "app.hypercerts.detail.viewExternal" })}
                  </a>
                  {hypercert.txHash && explorer && (
                    <a
                      href={`${explorer}/tx/${hypercert.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-stroke-sub px-3 py-2 text-xs font-medium text-text-sub transition hover:bg-bg-weak"
                    >
                      <RiExternalLinkLine className="h-4 w-4" />
                      {formatMessage({ id: "app.hypercerts.detail.viewTransaction" })}
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-xs text-text-sub sm:grid-cols-3">
                <div>
                  <span className="font-medium text-text-strong">
                    {formatMessage({ id: "app.hypercerts.detail.mintedOn" })}:
                  </span>{" "}
                  {hypercert.mintedAt
                    ? formatDate(hypercert.mintedAt * 1000, { dateStyle: "medium" })
                    : formatMessage({ id: "app.hypercerts.detail.dateUnknown" })}
                </div>
                <div>
                  <span className="font-medium text-text-strong">
                    {formatMessage({ id: "app.hypercerts.detail.attestations" })}:
                  </span>{" "}
                  {hypercert.attestationCount}
                </div>
                <div>
                  <span className="font-medium text-text-strong">
                    {formatMessage({ id: "app.hypercerts.detail.totalUnits" })}:
                  </span>{" "}
                  {hypercert.totalUnits.toLocaleString()}
                </div>
              </div>
            </section>

            {hypercert.imageUri && (
              <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-text-strong">
                  {formatMessage({ id: "app.hypercerts.detail.image" })}
                </h3>
                <div className="mt-3 aspect-square max-w-xs overflow-hidden rounded-lg border border-stroke-soft">
                  <ImageWithFallback
                    src={hypercert.imageUri}
                    alt={hypercert.title || formatMessage({ id: "app.hypercerts.detail.imageAlt" })}
                    className="h-full w-full object-cover"
                  />
                </div>
              </section>
            )}

            {hypercert.workScopes?.length ? (
              <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-text-strong">
                  {formatMessage({ id: "app.hypercerts.detail.workScopes" })}
                </h3>
                <p className="mt-2 text-sm text-text-sub">{hypercert.workScopes.join(", ")}</p>
              </section>
            ) : null}

            {/* Marketplace Section */}
            {canManage && garden && (
              <MarketplaceSection
                gardenAddress={garden.id as Address}
                hypercertId={hypercertId ? BigInt(hypercertId.split("-").pop() || "0") : 0n}
                hypercertIdString={hypercertId || ""}
                chainId={garden.chainId ?? DEFAULT_CHAIN_ID}
                listingDialogOpen={listingDialogOpen}
                setListingDialogOpen={setListingDialogOpen}
              />
            )}

            {hypercert.attestations && hypercert.attestations.length > 0 && (
              <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-text-strong">
                  {formatMessage({ id: "app.hypercerts.detail.attestationRefs" })}
                </h3>
                <div className="mt-3 space-y-2">
                  {hypercert.attestations.map((attestation) => (
                    <div
                      key={attestation.id}
                      className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-xs"
                    >
                      <div className="font-medium text-text-strong">{attestation.title}</div>
                      <div className="text-text-sub">
                        {attestation.gardenerName ?? attestation.gardenerAddress}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {hypercert.allowlistEntries && hypercert.allowlistEntries.length > 0 && (
              <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-text-strong">
                  {formatMessage({ id: "app.hypercerts.detail.claims" })}
                </h3>
                <div className="mt-3 overflow-hidden rounded-md border border-stroke-soft">
                  <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 border-b border-stroke-soft bg-bg-weak px-4 py-2 text-xs font-medium text-text-sub">
                    <span>{formatMessage({ id: "app.hypercerts.detail.claims.claimer" })}</span>
                    <span>{formatMessage({ id: "app.hypercerts.detail.claims.units" })}</span>
                    <span>{formatMessage({ id: "app.hypercerts.detail.claims.date" })}</span>
                  </div>
                  <div className="divide-y divide-stroke-soft">
                    {hypercert.allowlistEntries.map((claim) => (
                      <div
                        key={claim.id}
                        className="grid grid-cols-[2fr_1fr_1fr] gap-2 px-4 py-3 text-xs text-text-sub"
                      >
                        <span className="text-text-strong">{claim.claimant}</span>
                        <span>{claim.units.toLocaleString()}</span>
                        <span>
                          {claim.claimedAt
                            ? formatDate(claim.claimedAt * 1000, { dateStyle: "medium" })
                            : formatMessage({ id: "app.hypercerts.detail.dateUnknown" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {!hypercert.allowlistEntries?.length && (
              <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm text-sm text-text-sub">
                {formatMessage({ id: "app.hypercerts.detail.noClaims" })}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marketplace Section
// ---------------------------------------------------------------------------

function MarketplaceSection({
  gardenAddress,
  hypercertId,
  hypercertIdString,
  chainId,
  listingDialogOpen,
  setListingDialogOpen,
}: {
  gardenAddress: Address;
  hypercertId: bigint;
  hypercertIdString: string;
  chainId: number;
  listingDialogOpen: boolean;
  setListingDialogOpen: (open: boolean) => void;
}) {
  const { listings } = useHypercertListings(gardenAddress);

  // Find active listing for this hypercert
  const activeListing = listings.find((l) => l.active && l.hypercertId === hypercertId);

  const now = Math.floor(Date.now() / 1000);
  const isExpired = activeListing ? activeListing.endTime <= now : false;

  return (
    <>
      <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-strong">
            <RiExchangeDollarLine className="h-4 w-4 text-primary-base" />
            Marketplace
          </h3>
          {!activeListing && (
            <button
              type="button"
              onClick={() => setListingDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary-base px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary-darker"
            >
              <RiExchangeDollarLine className="h-3.5 w-3.5" />
              List for Yield
            </button>
          )}
        </div>

        <MarketplaceApprovalGate>
          {activeListing ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    isExpired
                      ? "bg-warning-lighter text-warning-dark"
                      : "bg-success-lighter text-success-dark"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isExpired ? "bg-warning-base" : "bg-success-base"
                    }`}
                  />
                  {isExpired ? "Expired" : "Listed for Yield"}
                </span>
              </div>
              <div className="grid gap-2 text-xs text-text-sub sm:grid-cols-3">
                <div>
                  <span className="font-medium text-text-strong">Price:</span>{" "}
                  {formatEther(activeListing.pricePerUnit)} ETH/unit
                </div>
                <div>
                  <span className="font-medium text-text-strong">Expires:</span>{" "}
                  {new Date(activeListing.endTime * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div>
                  <span className="font-medium text-text-strong">Order ID:</span> #
                  {activeListing.orderId}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-soft">
              This hypercert is not listed on the marketplace. List it for yield to allow supporters
              to purchase fractions.
            </p>
          )}
        </MarketplaceApprovalGate>
      </section>

      {/* Trade History */}
      {hypercertId > 0n && (
        <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-text-strong">Trade History</h3>
          <TradeHistoryTable hypercertId={hypercertId} chainId={chainId} />
        </section>
      )}

      {/* Create Listing Dialog */}
      <CreateListingDialog
        open={listingDialogOpen}
        onOpenChange={setListingDialogOpen}
        gardenAddress={gardenAddress}
        hypercertId={hypercertId}
        fractionId={hypercertId}
      />
    </>
  );
}
