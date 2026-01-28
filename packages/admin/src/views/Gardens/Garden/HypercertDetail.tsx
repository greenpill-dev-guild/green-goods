import {
  DEFAULT_CHAIN_ID,
  formatDate,
  getNetworkConfig,
  ImageWithFallback,
  useGardens,
  useHypercerts,
  type OptimisticHypercertData,
} from "@green-goods/shared";
import { RiExternalLinkLine, RiLoader4Line, RiCheckLine } from "@remixicon/react";
import { useParams, useLocation } from "react-router-dom";
import { useIntl } from "react-intl";
import { PageHeader } from "@/components/Layout/PageHeader";

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
