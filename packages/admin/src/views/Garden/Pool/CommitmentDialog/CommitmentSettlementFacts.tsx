import type { CommitmentSettlementController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { formatGdollar, readinessReasonMessage, shortAddress } from "../poolFundingPresentation";
import { payoutKindLabel, planStatusLabel } from "./commitmentSettlementPresentation";

function fact(label: string, value: ReactNode, key: string) {
  return (
    <div key={key} className="flex justify-between gap-3 text-body-md" data-fact={key}>
      <dt className="shrink-0 text-text-soft">{label}</dt>
      <dd className="text-right text-text-strong">{value}</dd>
    </div>
  );
}

/**
 * Who pays whom how much, and whether the destination, caps, fees and route
 * are ready — every value from the controller's chain and funding reads.
 */
export function CommitmentSettlementFacts({
  settlement,
}: {
  settlement: CommitmentSettlementController;
}) {
  const intl = useIntl();
  const { formatMessage, locale } = intl;
  const kind = settlement.kind;
  const amount = settlement.declaredAmount;
  const snapshot = settlement.funding.snapshot;
  const cap = snapshot?.limits.maxTransferAmount ?? null;
  const who = (address: string) => shortAddress(address as `0x${string}`);

  const recipient =
    kind === "GARDEN_BENEFICIARY"
      ? settlement.beneficiaryGarden
        ? formatMessage(
            {
              id: "cockpit.garden.pool.settlement.fact.recipientGarden",
              defaultMessage: "{garden} · Safe {safe}",
            },
            {
              garden: who(settlement.beneficiaryGarden),
              safe: settlement.beneficiaryAccount
                ? who(settlement.beneficiaryAccount.account)
                : "—",
            }
          )
        : "—"
      : formatMessage(
          {
            id: "cockpit.garden.pool.settlement.fact.recipientMembers",
            defaultMessage: "{count, plural, one {# contributor} other {# contributors}}",
          },
          {
            count:
              settlement.rows.length || settlement.chain?.commitment.eligibleContributorCount || 0,
          }
        );

  const destination =
    kind === "GARDEN_BENEFICIARY"
      ? settlement.beneficiaryAccount?.active
        ? formatMessage({
            id: "cockpit.garden.pool.settlement.destination.safeActive",
            defaultMessage: "Beneficiary Safe registered and active",
          })
        : formatMessage({
            id: "cockpit.garden.pool.settlement.destination.safeInactive",
            defaultMessage: "Beneficiary Safe is missing or inactive",
          })
      : settlement.chain?.gardenerDeliveryEnabled
        ? formatMessage({
            id: "cockpit.garden.pool.settlement.destination.deliveryOn",
            defaultMessage: "Gardener delivery is on",
          })
        : formatMessage({
            id: "cockpit.garden.pool.settlement.destination.deliveryOff",
            defaultMessage: "Gardener delivery is off",
          });

  const capLine =
    cap === null || amount === null
      ? formatMessage({
          id: "cockpit.garden.pool.settlement.cap.unknown",
          defaultMessage: "Cap not read",
        })
      : amount <= cap
        ? formatMessage(
            {
              id: "cockpit.garden.pool.settlement.cap.within",
              defaultMessage: "{cap} · within cap",
            },
            { cap: formatGdollar(cap, locale) }
          )
        : formatMessage(
            {
              id: "cockpit.garden.pool.settlement.cap.exceeded",
              defaultMessage: "{cap} · amount exceeds the cap",
            },
            { cap: formatGdollar(cap, locale) }
          );

  const readiness = !snapshot
    ? formatMessage({
        id: "cockpit.garden.pool.settlement.readiness.unread",
        defaultMessage: "Not read yet",
      })
    : snapshot.settlementReadiness === "ready"
      ? formatMessage({
          id: "cockpit.garden.pool.settlement.readiness.ready",
          defaultMessage: "Ready",
        })
      : snapshot.settlementUnavailableReasons
          .map((reason) => readinessReasonMessage(reason, intl))
          .join(" ");

  return (
    <dl className="space-y-1" data-component="CommitmentSettlementFacts">
      {fact(
        formatMessage({
          id: "cockpit.garden.pool.settlement.fact.kind",
          defaultMessage: "Payout kind",
        }),
        kind ? payoutKindLabel(kind, intl) : "—",
        "kind"
      )}
      {fact(
        formatMessage({
          id: "cockpit.garden.pool.settlement.fact.payer",
          defaultMessage: "Paid from",
        }),
        settlement.payerGarden
          ? formatMessage(
              {
                id: "cockpit.garden.pool.settlement.fact.payerSafe",
                defaultMessage: "{garden} · Safe {safe}",
              },
              {
                garden: who(settlement.payerGarden),
                safe: settlement.payerAccount ? who(settlement.payerAccount.account) : "—",
              }
            )
          : "—",
        "payer"
      )}
      {fact(
        formatMessage({
          id: "cockpit.garden.pool.settlement.fact.recipient",
          defaultMessage: "Paid to",
        }),
        recipient,
        "recipient"
      )}
      {fact(
        formatMessage({
          id: "cockpit.garden.pool.settlement.fact.amount",
          defaultMessage: "Amount",
        }),
        formatGdollar(amount, locale),
        "amount"
      )}
      {fact(
        formatMessage({
          id: "cockpit.garden.pool.settlement.fact.destination",
          defaultMessage: "Destination",
        }),
        destination,
        "destination"
      )}
      {fact(
        formatMessage({
          id: "cockpit.garden.pool.settlement.fact.cap",
          defaultMessage: "Per-transfer cap",
        }),
        capLine,
        "cap"
      )}
      {fact(
        formatMessage({
          id: "cockpit.garden.pool.settlement.fact.readiness",
          defaultMessage: "Fees and route",
        }),
        readiness,
        "readiness"
      )}
      {fact(
        formatMessage({
          id: "cockpit.garden.pool.settlement.fact.plan",
          defaultMessage: "Payout plan",
        }),
        settlement.plan
          ? formatMessage(
              {
                id: "cockpit.garden.pool.settlement.plan.id",
                defaultMessage: "Plan #{id} · {status}",
              },
              {
                id: settlement.plan.payoutPlanId.toString(),
                status: planStatusLabel(settlement.plan.status, intl),
              }
            )
          : formatMessage({
              id: "cockpit.garden.pool.settlement.plan.none",
              defaultMessage: "Not created yet",
            }),
        "plan"
      )}
    </dl>
  );
}
