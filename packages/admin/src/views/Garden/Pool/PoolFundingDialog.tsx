import type { PoolFundingControllerView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiFundsLine } from "@remixicon/react";
import type { RefObject } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { formatGdollar, readinessReasonMessage, shortAddress } from "./poolFundingPresentation";

export interface PoolFundingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funding: PoolFundingControllerView;
  protocolContext?: boolean;
  tone: "garden" | "community";
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-soft">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-text-strong">{value}</dd>
    </div>
  );
}

export function PoolFundingDialog({
  open,
  onOpenChange,
  funding,
  protocolContext = false,
  tone,
  returnFocusRef,
}: PoolFundingDialogProps) {
  const intl = useIntl();
  const { formatMessage, locale } = intl;
  const snapshot = funding.snapshot;
  const amount = (value: bigint | null) => formatGdollar(value, locale, true);
  const address = (value: string | null) => (value ? `${shortAddress(value)} · ${value}` : "—");

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage({
        id: "cockpit.garden.pool.funding.dialog.title",
        defaultMessage: "Pool funding details",
      })}
      description={formatMessage({
        id: "cockpit.garden.pool.funding.dialog.description",
        defaultMessage: "How live G$ liquidity, obligations, fees, and settlement limits combine.",
      })}
      icon={RiFundsLine}
      size="lg"
      tone={tone}
      bodyClassName="space-y-6"
      finalFocusRef={returnFocusRef}
    >
      {protocolContext ? (
        <p className="rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container))] p-3 text-sm text-text-sub">
          {formatMessage({
            id: "cockpit.garden.pool.funding.protocolNote",
            defaultMessage:
              "Upstream treasury inflow is not recorded here; the Celo Safe balance is authoritative.",
          })}
        </p>
      ) : null}

      <section aria-labelledby="funding-composition-title" className="space-y-3">
        <h3 id="funding-composition-title" className="label-lg text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.composition",
            defaultMessage: "Balance composition",
          })}
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.balance",
              defaultMessage: "Onchain balance",
            })}
            value={amount(snapshot?.balance?.value ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.committed",
              defaultMessage: "Committed",
            })}
            value={amount(snapshot?.committed ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.expected",
              defaultMessage: "Expected commitments",
            })}
            value={amount(snapshot?.expected ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.feeBuffer",
              defaultMessage: "Conservative fee buffer",
            })}
            value={amount(snapshot?.feeBuffer ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.available",
              defaultMessage: "Available for new commitments",
            })}
            value={amount(snapshot?.available ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.topUp",
              defaultMessage: "Suggested top-up",
            })}
            value={amount(snapshot?.suggestedTopUp ?? null)}
          />
        </dl>
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.funding.topUp.note",
            defaultMessage:
              "The suggested top-up is informational. This view cannot move or pull treasury funds.",
          })}
        </p>
        {snapshot?.obligations.length ? (
          <div className="space-y-2">
            <h4 className="label-md text-text-strong">
              {formatMessage({
                id: "cockpit.garden.pool.funding.dialog.obligations",
                defaultMessage: "Obligation breakdown",
              })}
            </h4>
            <ul className="divide-y divide-stroke-soft rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container))] px-3">
              {snapshot.obligations.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span className="text-text-sub">
                    {formatMessage({
                      id: `cockpit.garden.pool.funding.obligation.${row.kind}`,
                      defaultMessage:
                        row.kind === "plan"
                          ? "Finalized payout plan"
                          : row.kind === "funding"
                            ? "Member funding"
                            : row.kind === "standalone"
                              ? "Standalone disbursement"
                              : "Expected commitment",
                    })}
                  </span>
                  <span className="font-medium text-text-strong">
                    {formatMessage(
                      {
                        id: "cockpit.garden.pool.funding.obligation.amount",
                        defaultMessage: "{net} + {fee} fee buffer",
                      },
                      { net: amount(row.netAmount), fee: amount(row.feeBuffer) }
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="funding-transit-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <h3 id="funding-transit-title" className="label-lg text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.transit",
            defaultMessage: "Funds in transit",
          })}
        </h3>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.transit.dispatched",
              defaultMessage: "Dispatched",
            })}
            value={amount(snapshot?.transit.dispatched ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.transit.executed",
              defaultMessage: "Executed, awaiting confirmation",
            })}
            value={amount(snapshot?.transit.executedAwaitingConfirmation ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.transit.incoming",
              defaultMessage: "Expected incoming funding",
            })}
            value={amount(snapshot?.transit.incoming ?? null)}
          />
        </dl>
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.funding.transit.note",
            defaultMessage:
              "Transit is a breakdown of obligations, not an additional deduction. Incoming funding is excluded until it reaches the Safe.",
          })}
        </p>
      </section>

      <section
        aria-labelledby="funding-fees-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <h3 id="funding-fees-title" className="label-lg text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.fees",
            defaultMessage: "GoodDollar fees",
          })}
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.quotedFees",
              defaultMessage: "Current quoted fees",
            })}
            value={amount(snapshot?.quotedFees ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.feeBuffer",
              defaultMessage: "Conservative fee buffer",
            })}
            value={amount(snapshot?.feeBuffer ?? null)}
          />
        </dl>
        {snapshot?.feeQuotes.length ? (
          <ul className="divide-y divide-stroke-soft rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container))] px-3">
            {snapshot.feeQuotes.map((quote) => (
              <li
                key={quote.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-text-sub">
                  {quote.recipient ? shortAddress(quote.recipient) : "—"} · {amount(quote.amount)}
                </span>
                <span className="font-medium text-text-strong">
                  {quote.fee === null
                    ? formatMessage({
                        id: "cockpit.garden.pool.funding.fees.quoteUnavailable",
                        defaultMessage: "Quote unavailable",
                      })
                    : formatMessage(
                        {
                          id: "cockpit.garden.pool.funding.fees.quote",
                          defaultMessage: "{fee} · {payer}",
                        },
                        {
                          fee: amount(quote.fee),
                          payer: quote.senderPays
                            ? formatMessage({
                                id: "cockpit.garden.pool.funding.fees.senderPays",
                                defaultMessage: "sender pays",
                              })
                            : formatMessage({
                                id: "cockpit.garden.pool.funding.fees.receiverPays",
                                defaultMessage: "recipient pays",
                              }),
                        }
                      )}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-labelledby="funding-limits-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <h3 id="funding-limits-title" className="label-lg text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.limits",
            defaultMessage: "Settlement limits",
          })}
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.rolesAllowance",
              defaultMessage: "Safe allowance remaining",
            })}
            value={amount(snapshot?.limits.rolesAllowanceRemaining ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.periodAllowance",
              defaultMessage: "Period allowance remaining",
            })}
            value={amount(snapshot?.limits.periodAllowanceRemaining ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.transferCap",
              defaultMessage: "Per-transfer cap",
            })}
            value={amount(snapshot?.limits.maxTransferAmount ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.batchCap",
              defaultMessage: "Batch amount cap",
            })}
            value={amount(snapshot?.limits.maxBatchAmount ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.batchSize",
              defaultMessage: "Batch size limit",
            })}
            value={snapshot?.limits.batchSizeLimit?.toLocaleString(locale) ?? "—"}
          />
        </dl>
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.funding.limits.note",
            defaultMessage:
              "Limits constrain settlement execution. They are not subtracted from the Safe balance.",
          })}
        </p>
      </section>

      <section
        aria-labelledby="funding-route-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <h3 id="funding-route-title" className="label-lg text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.route",
            defaultMessage: "Account and route readiness",
          })}
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.route.account",
              defaultMessage: "Registered account",
            })}
            value={address(snapshot?.routeAddresses.account ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.route.indexed",
              defaultMessage: "Indexed Celo route",
            })}
            value={address(snapshot?.routeAddresses.indexed ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.route.live",
              defaultMessage: "Live Celo route",
            })}
            value={address(snapshot?.routeAddresses.live ?? null)}
          />
        </dl>
        {snapshot?.settlementUnavailableReasons.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-sub">
            {snapshot.settlementUnavailableReasons.map((reason) => (
              <li key={reason}>{readinessReasonMessage(reason, intl)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.garden.pool.funding.ready",
              defaultMessage: "Account, route, token, fees, and limits are ready.",
            })}
          </p>
        )}
      </section>

      <section
        aria-labelledby="funding-network-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <h3 id="funding-network-title" className="label-lg text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.networkFees",
            defaultMessage: "Network fees",
          })}
        </h3>
        <Fact
          label={formatMessage({
            id: "cockpit.garden.pool.funding.nativeReserve",
            defaultMessage: "Celo acknowledgment reserve",
          })}
          value={
            snapshot?.nativeFeeBalance === null || snapshot?.nativeFeeBalance === undefined
              ? "—"
              : `${formatTokenAmount(snapshot.nativeFeeBalance, 18, 18, locale, true)} CELO`
          }
        />
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.funding.nativeReserve.note",
            defaultMessage:
              "This native CELO reserve pays CCIP acknowledgment fees. It is not G$ pool liquidity.",
          })}
        </p>
      </section>
    </AdminDialog>
  );
}
