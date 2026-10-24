import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { PoolFundingSnapshot } from "@green-goods/shared/modules/commitment-pooling/pool-funding";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { formatGdollar, shortAddress } from "./poolFundingPresentation";

export interface PoolFundingDialogFinancialSectionsProps {
  snapshot: PoolFundingSnapshot | null;
}

export function PoolFundingDialogFinancialSections({
  snapshot,
}: PoolFundingDialogFinancialSectionsProps) {
  const { formatMessage, locale } = useIntl();
  const amount = (value: bigint | null) => formatGdollar(value, locale, true);

  return (
    <>
      <section aria-labelledby="funding-composition-title" className="space-y-3">
        <AdminCardTitle id="funding-composition-title">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.composition",
            defaultMessage: "Balance Composition",
          })}
        </AdminCardTitle>
        <FactList frame="inset">
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.balance",
              defaultMessage: "Onchain balance",
            })}
            value={amount(snapshot?.balance?.value ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.committed",
              defaultMessage: "Committed",
            })}
            value={amount(snapshot?.committed ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.expected",
              defaultMessage: "Expected promise rewards",
            })}
            value={amount(snapshot?.expected ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.feeBuffer",
              defaultMessage: "Conservative fee buffer",
            })}
            value={amount(snapshot?.feeBuffer ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.availablePromises",
              defaultMessage: "Available for new promises",
            })}
            value={amount(snapshot?.available ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.topUp",
              defaultMessage: "Suggested top-up",
            })}
            value={amount(snapshot?.suggestedTopUp ?? null)}
          />
        </FactList>
        <p className="type-meta text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.funding.topUp.note",
            defaultMessage:
              "The suggested top-up is informational. This view cannot move or pull treasury funds.",
          })}
        </p>
        {snapshot?.obligations.length ? (
          <div className="space-y-2">
            <AdminCardTitle as="h4">
              {formatMessage({
                id: "cockpit.garden.pool.funding.dialog.obligations",
                defaultMessage: "Obligation Breakdown",
              })}
            </AdminCardTitle>
            <FactList frame="inset">
              {snapshot.obligations.map((row) => (
                <FactRow
                  key={row.id}
                  label={formatMessage({
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
                  value={formatMessage(
                    {
                      id: "cockpit.garden.pool.funding.obligation.amount",
                      defaultMessage: "{net} + {fee} fee buffer",
                    },
                    { net: amount(row.netAmount), fee: amount(row.feeBuffer) }
                  )}
                />
              ))}
            </FactList>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="funding-transit-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <AdminCardTitle id="funding-transit-title">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.transit",
            defaultMessage: "Funds in Transit",
          })}
        </AdminCardTitle>
        <FactList frame="inset">
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.transit.dispatched",
              defaultMessage: "Dispatched",
            })}
            value={amount(snapshot?.transit.dispatched ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.transit.executed",
              defaultMessage: "Executed, awaiting confirmation",
            })}
            value={amount(snapshot?.transit.executedAwaitingConfirmation ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.transit.incoming",
              defaultMessage: "Expected incoming funding",
            })}
            value={amount(snapshot?.transit.incoming ?? null)}
          />
        </FactList>
        <p className="type-meta text-text-soft">
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
        <AdminCardTitle id="funding-fees-title">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.fees",
            defaultMessage: "GoodDollar Fees",
          })}
        </AdminCardTitle>
        <FactList frame="inset">
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.quotedFees",
              defaultMessage: "Current quoted fees",
            })}
            value={amount(snapshot?.quotedFees ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.feeBuffer",
              defaultMessage: "Conservative fee buffer",
            })}
            value={amount(snapshot?.feeBuffer ?? null)}
          />
        </FactList>
        {snapshot?.feeQuotes.length ? (
          <FactList frame="inset">
            {snapshot.feeQuotes.map((quote) => (
              <FactRow
                key={quote.id}
                label={`${quote.recipient ? shortAddress(quote.recipient) : "—"} · ${amount(quote.amount)}`}
                value={
                  quote.fee === null || quote.senderPays === null
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
                      )
                }
              />
            ))}
          </FactList>
        ) : null}
      </section>

      <section
        aria-labelledby="funding-limits-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <AdminCardTitle id="funding-limits-title">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.limits",
            defaultMessage: "Settlement Limits",
          })}
        </AdminCardTitle>
        <FactList frame="inset">
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.rolesAllowance",
              defaultMessage: "Safe allowance remaining",
            })}
            value={amount(snapshot?.limits.rolesAllowanceRemaining ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.periodAllowance",
              defaultMessage: "Period allowance remaining",
            })}
            value={amount(snapshot?.limits.periodAllowanceRemaining ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.transferCap",
              defaultMessage: "Per-transfer cap",
            })}
            value={amount(snapshot?.limits.maxTransferAmount ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.batchCap",
              defaultMessage: "Batch amount cap",
            })}
            value={amount(snapshot?.limits.maxBatchAmount ?? null)}
          />
          <FactRow
            label={formatMessage({
              id: "cockpit.garden.pool.funding.batchSize",
              defaultMessage: "Batch size limit",
            })}
            value={snapshot?.limits.batchSizeLimit?.toLocaleString(locale) ?? "—"}
          />
        </FactList>
        <p className="type-meta text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.funding.limits.note",
            defaultMessage:
              "Limits constrain settlement execution. They are not subtracted from the Safe balance.",
          })}
        </p>
      </section>
    </>
  );
}
