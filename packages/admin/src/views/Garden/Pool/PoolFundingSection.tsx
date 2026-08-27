import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { PoolFundingControllerView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { getBlockExplorer } from "@green-goods/shared/utils/blockchain/chain-registry";
import {
  RiAlertLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiInformationLine,
  RiRefreshLine,
} from "@remixicon/react";
import { type RefObject, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { formatGdollar, fundingStateMessage, shortAddress } from "./poolFundingPresentation";

export interface PoolFundingSectionProps {
  funding: PoolFundingControllerView;
  protocolContext?: boolean;
  onOpenDetails: () => void;
  detailsButtonRef?: RefObject<HTMLButtonElement | null>;
}

function fundingVariant(state: NonNullable<PoolFundingControllerView["snapshot"]>["fundingState"]) {
  if (state === "healthy" || state === "no-demand") return "success" as const;
  if (state === "low") return "warning" as const;
  if (state === "insufficient") return "error" as const;
  return "neutral" as const;
}

export function PoolFundingSection({
  funding,
  protocolContext = false,
  onOpenDetails,
  detailsButtonRef,
}: PoolFundingSectionProps) {
  const intl = useIntl();
  const { formatMessage, locale, formatTime } = intl;
  const [manualRefresh, setManualRefresh] = useState<"idle" | "running" | "done">("idle");
  const snapshot = funding.snapshot;
  const stale = (funding.isError || funding.hasStaleBalance) && snapshot !== null;
  const derivedUnavailable = stale || snapshot?.fundingState === "unavailable";
  const handleRefresh = async () => {
    setManualRefresh("running");
    await funding.refetch();
    setManualRefresh("done");
  };

  return (
    <section
      className="space-y-3 border-t border-stroke-soft pt-4"
      aria-labelledby="pool-funding-title"
      data-component="PoolFundingSection"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 id="pool-funding-title" className="label-md text-text-strong">
            {formatMessage({
              id: "cockpit.garden.pool.funding.title",
              defaultMessage: "Pool funding",
            })}
          </h4>
          <p className="mt-1 text-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.funding.description",
              defaultMessage: "Live G$ in the registered Celo Safe.",
            })}
          </p>
        </div>
        <AdminButton
          type="button"
          variant="text"
          size="sm"
          className="!h-11 !w-11 !px-0"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.funding.refresh",
            defaultMessage: "Refresh pool funding",
          })}
          title={formatMessage({
            id: "cockpit.garden.pool.funding.refresh",
            defaultMessage: "Refresh pool funding",
          })}
          onClick={() => void handleRefresh()}
          loading={manualRefresh === "running"}
        >
          {manualRefresh === "running" ? null : <RiRefreshLine className="h-4 w-4" aria-hidden />}
        </AdminButton>
      </div>

      {funding.isLoading && !snapshot ? (
        <div
          role="status"
          className="space-y-2"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.funding.loading",
            defaultMessage: "Loading pool funding",
          })}
        >
          <div className="h-5 rounded-[var(--m3-shape-xs)] skeleton-shimmer" aria-hidden />
          <div className="h-12 rounded-[var(--m3-shape-sm)] skeleton-shimmer" aria-hidden />
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div className="col-span-2">
              <dt className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.funding.safe",
                  defaultMessage: "Celo Safe",
                })}
              </dt>
              <dd className="mt-0.5 font-medium text-text-strong">
                {snapshot?.safe ? (
                  <a
                    className="inline-flex min-h-11 items-center gap-1 underline decoration-stroke-soft underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]"
                    href={`${getBlockExplorer(42220)}/address/${snapshot.safe}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddress(snapshot.safe)}
                    <RiExternalLinkLine className="h-4 w-4" aria-hidden />
                    <span className="sr-only">
                      {formatMessage({
                        id: "cockpit.garden.pool.funding.opensExplorer",
                        defaultMessage: "Opens in Celo Explorer",
                      })}
                    </span>
                  </a>
                ) : funding.isError && !snapshot ? (
                  fundingStateMessage("unavailable", intl)
                ) : (
                  formatMessage({
                    id: "cockpit.garden.pool.funding.noSafe",
                    defaultMessage: "No settlement Safe configured",
                  })
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.funding.balance",
                  defaultMessage: "Onchain balance",
                })}
              </dt>
              <dd className="mt-0.5 font-semibold text-text-strong">
                {formatGdollar(snapshot?.balance?.value ?? null, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.funding.committed",
                  defaultMessage: "Committed",
                })}
              </dt>
              <dd className="mt-0.5 font-semibold text-text-strong">
                {formatGdollar(derivedUnavailable ? null : (snapshot?.committed ?? null), locale)}
              </dd>
            </div>
            <div className="col-span-2 rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container))] p-3">
              <dt className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.funding.available",
                  defaultMessage: "Available for new commitments",
                })}
              </dt>
              <dd className="mt-1 text-title-md font-semibold text-text-strong">
                {formatGdollar(derivedUnavailable ? null : (snapshot?.available ?? null), locale)}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <StatusBadge
              variant={fundingVariant(
                derivedUnavailable ? "unavailable" : (snapshot?.fundingState ?? "unavailable")
              )}
              size="sm"
              icon={
                derivedUnavailable ? (
                  <RiAlertLine />
                ) : snapshot?.fundingState === "healthy" ||
                  snapshot?.fundingState === "no-demand" ? (
                  <RiCheckLine />
                ) : (
                  <RiInformationLine />
                )
              }
            >
              {fundingStateMessage(
                derivedUnavailable ? "unavailable" : (snapshot?.fundingState ?? "unavailable"),
                intl
              )}
            </StatusBadge>
            <StatusBadge
              variant={snapshot?.settlementReadiness === "ready" && !stale ? "success" : "warning"}
              size="sm"
            >
              {snapshot?.settlementReadiness === "ready" && !stale
                ? formatMessage({
                    id: "cockpit.garden.pool.funding.settlementReady",
                    defaultMessage: "Settlement ready",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.funding.settlementUnavailable",
                    defaultMessage: "Settlement unavailable",
                  })}
            </StatusBadge>
          </div>

          <p className="text-xs text-text-soft">
            {funding.isRefetching
              ? formatMessage({
                  id: "cockpit.garden.pool.funding.refreshing",
                  defaultMessage: "Refreshing…",
                })
              : snapshot?.balance?.readAt
                ? `${stale ? formatMessage({ id: "cockpit.garden.pool.funding.lastRead", defaultMessage: "Last read" }) : formatMessage({ id: "cockpit.garden.pool.funding.readAt", defaultMessage: "Read" })} ${formatTime(snapshot.balance.readAt * 1_000, { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
                : formatMessage({
                    id: "cockpit.garden.pool.funding.notRead",
                    defaultMessage: "No current balance read",
                  })}
          </p>

          {protocolContext ? (
            <p className="text-xs text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.funding.protocolNote",
                defaultMessage:
                  "Upstream treasury inflow is not recorded here; the Celo Safe balance is authoritative.",
              })}
            </p>
          ) : null}

          <AdminButton
            ref={detailsButtonRef}
            type="button"
            variant="outlined"
            size="sm"
            className="w-full"
            onClick={onOpenDetails}
          >
            {formatMessage({
              id: "cockpit.garden.pool.funding.viewDetails",
              defaultMessage: "View funding details",
            })}
          </AdminButton>
        </>
      )}

      <span className="sr-only" aria-live="polite">
        {manualRefresh === "done"
          ? formatMessage({
              id: "cockpit.garden.pool.funding.refreshComplete",
              defaultMessage: "Pool funding refreshed",
            })
          : ""}
      </span>
    </section>
  );
}
