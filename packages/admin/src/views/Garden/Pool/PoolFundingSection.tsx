import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { PoolFundingControllerView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useGoodDollarPrice } from "@green-goods/shared/hooks/blockchain/useGoodDollarPrice";
import { goodDollarWeiToUsdCents } from "@green-goods/shared/modules/wallet/good-dollar-price";
import { RiAlertLine, RiCheckLine, RiInformationLine, RiRefreshLine } from "@remixicon/react";
import { type RefObject, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import {
  formatGdollar,
  fundingReadIssueMessage,
  fundingStateMessage,
  primaryUnavailableReason,
  readinessReasonMessage,
} from "./poolFundingPresentation";
import { formatGoodDollarsCompact, formatUsdSummary } from "./poolPresentation";

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

/**
 * Pool Funding, as its own compact card at the foot of the Pool tab's right
 * column (PRD-1025 D9): what is available for new promises first, in dollars
 * with the G$ amount beside, then one line for the Safe and what is committed,
 * the funding and settlement chips, and the read time with View Details. The
 * Safe's address lives in the details dialog. Dollars come from the same G$
 * price the rewards use; without it the G$ amounts stand alone.
 */
export function PoolFundingSection({
  funding,
  protocolContext = false,
  onOpenDetails,
  detailsButtonRef,
}: PoolFundingSectionProps) {
  const intl = useIntl();
  const { formatMessage, locale, formatTime } = intl;
  const price = useGoodDollarPrice();
  const [manualRefresh, setManualRefresh] = useState<"idle" | "running" | "done">("idle");
  const snapshot = funding.snapshot;
  const stale = (funding.isError || funding.hasStaleBalance) && snapshot !== null;
  const readIssue = fundingReadIssueMessage(funding, intl);
  const derivedUnavailable = stale || snapshot?.fundingState === "unavailable";
  // A chip that only says "unavailable" is a dead end; the card names what is
  // in the way, the same words the details dialog lists in full.
  const blockedBy =
    snapshot && (derivedUnavailable || snapshot.settlementReadiness !== "ready")
      ? primaryUnavailableReason(snapshot)
      : null;
  const handleRefresh = async () => {
    setManualRefresh("running");
    await funding.refetch();
    setManualRefresh("done");
  };

  /** Dollars at today's G$ price, or null while there is no price to read them at. */
  const dollars = (wei: bigint | null | undefined) =>
    wei === null || wei === undefined || price.state.status !== "ready"
      ? null
      : formatUsdSummary(goodDollarWeiToUsdCents(wei, price.state.price), locale);
  /** An amount as the card reads it: dollars first, G$ when dollars can't be read. */
  const amount = (wei: bigint | null | undefined) =>
    dollars(wei) ?? formatGdollar(wei ?? null, locale);

  const available = derivedUnavailable ? null : (snapshot?.available ?? null);
  const availableDollars = dollars(available);

  return (
    <section
      className="space-y-2"
      aria-labelledby="pool-funding-title"
      data-component="PoolFundingSection"
    >
      <div className="flex items-center justify-between gap-2">
        <AdminCardTitle as="h3" id="pool-funding-title">
          {formatMessage({
            id: "cockpit.garden.pool.funding.title",
            defaultMessage: "Pool Funding",
          })}
        </AdminCardTitle>
        <AdminIconButton
          size="lg"
          label={formatMessage({
            id: "cockpit.garden.pool.funding.refresh",
            defaultMessage: "Refresh Pool Funding",
          })}
          onClick={() => void handleRefresh()}
          loading={manualRefresh === "running"}
        >
          <RiRefreshLine />
        </AdminIconButton>
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
          <div className="h-12 rounded-[var(--m3-shape-sm)] skeleton-shimmer" aria-hidden />
          <div className="h-5 rounded-[var(--m3-shape-xs)] skeleton-shimmer" aria-hidden />
        </div>
      ) : (
        <>
          <div className="space-y-0.5">
            <p className="body-xs text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.funding.availablePromises",
                defaultMessage: "Available for new promises",
              })}
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className="text-title-md font-semibold text-text-strong">
                {availableDollars ?? formatGdollar(available, locale)}
              </span>
              {available !== null && availableDollars !== null ? (
                <span className="body-sm text-text-sub">
                  {formatMessage(
                    {
                      id: "cockpit.garden.pool.funding.aboutGoodDollars",
                      defaultMessage: "about {amount} G$",
                    },
                    { amount: formatGoodDollarsCompact(available, locale) }
                  )}
                </span>
              ) : null}
            </p>
          </div>

          <p className="body-xs text-text-sub tabular-nums" data-slot="funding-safe-line">
            {snapshot?.safe
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.funding.safeLine",
                    defaultMessage: "{balance} in the Safe · {committed} committed",
                  },
                  {
                    balance: amount(snapshot.balance?.value ?? null),
                    committed: amount(derivedUnavailable ? null : snapshot.committed),
                  }
                )
              : funding.isError && !snapshot
                ? fundingStateMessage("unavailable", intl)
                : formatMessage({
                    id: "cockpit.garden.pool.funding.noSafe",
                    defaultMessage: "No settlement Safe configured",
                  })}
          </p>

          <div className="flex flex-wrap gap-1.5">
            <StatusBadge
              variant={fundingVariant(
                derivedUnavailable ? "unavailable" : (snapshot?.fundingState ?? "unavailable")
              )}
              size="sm"
              icon={
                derivedUnavailable ? (
                  <RiAlertLine className="h-3 w-3" />
                ) : snapshot?.fundingState === "healthy" ||
                  snapshot?.fundingState === "no-demand" ? (
                  <RiCheckLine className="h-3 w-3" />
                ) : (
                  <RiInformationLine className="h-3 w-3" />
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

          {readIssue || blockedBy ? (
            <p className="body-xs text-text-sub" data-slot="funding-blocked-by">
              {readIssue ?? (blockedBy ? readinessReasonMessage(blockedBy, intl) : null)}
            </p>
          ) : null}

          {protocolContext ? (
            <p className="body-xs text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.funding.protocolNote",
                defaultMessage:
                  "Upstream treasury inflow is not recorded here; the Celo Safe balance is authoritative.",
              })}
            </p>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-1 body-xs text-text-sub">
            <span>
              {funding.isRefetching
                ? formatMessage({
                    id: "cockpit.garden.pool.funding.refreshing",
                    defaultMessage: "Refreshing…",
                  })
                : snapshot?.balance?.readAt
                  ? `${stale ? formatMessage({ id: "cockpit.garden.pool.funding.lastRead", defaultMessage: "Last read" }) : formatMessage({ id: "cockpit.garden.pool.funding.readAt", defaultMessage: "Read" })} ${formatTime(snapshot.balance.readAt * 1_000, { hour: "numeric", minute: "2-digit" })}`
                  : formatMessage({
                      id: "cockpit.garden.pool.funding.notRead",
                      defaultMessage: "No current balance read",
                    })}
            </span>
            <span aria-hidden>·</span>
            <AdminButton
              ref={detailsButtonRef}
              type="button"
              variant="text"
              size="sm"
              onClick={onOpenDetails}
            >
              {formatMessage({
                id: "cockpit.garden.pool.funding.openDetails",
                defaultMessage: "View Details",
              })}
            </AdminButton>
          </p>
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
