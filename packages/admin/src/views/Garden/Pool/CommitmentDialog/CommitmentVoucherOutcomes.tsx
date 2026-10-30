import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type {
  CommitmentRewardOutcome,
  CommitmentVoucherOutcomes as Outcomes,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { type IntlShape, useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { FactValue } from "../VoucherActDialog";
import { shortAddress } from "../poolPresentation";
import { voucherCount } from "../voucherPresentation";

type FormatMessage = IntlShape["formatMessage"];

const STATUS: Record<
  CommitmentRewardOutcome["status"],
  { id: string; defaultMessage: string; tone: ItemRowTone }
> = {
  preparing: {
    id: "app.voucher.wait.rewardPreparing",
    defaultMessage: "Being prepared",
    tone: "info",
  },
  unavailable: {
    id: "app.voucher.wait.rewardUnavailable",
    defaultMessage: "Status unavailable",
    tone: "warning",
  },
  "after-work": {
    id: "app.voucher.rw.s.notYet",
    defaultMessage: "After the work",
    tone: "neutral",
  },
  "on-the-way": { id: "app.voucher.rw.s.pending", defaultMessage: "On the way", tone: "info" },
  waiting: { id: "app.voucher.rw.s.waiting", defaultMessage: "Waiting", tone: "warning" },
  delayed: { id: "app.voucher.rw.s.delayed", defaultMessage: "Delayed", tone: "warning" },
  received: { id: "app.voucher.rw.s.received", defaultMessage: "Received", tone: "success" },
};

/** The pool listing's words, as the Voucher Issuers card says them. */
const POOL_STATUS = {
  setup: { id: "cockpit.community.voucherIssuers.st.setup", defaultMessage: "Setup pending" },
  listed: { id: "cockpit.community.voucherIssuers.st.listed", defaultMessage: "Listed" },
  delisted: { id: "cockpit.community.voucherIssuers.st.delisted", defaultMessage: "Delisted" },
} as const;

/** The issuer's name, else its token's symbol, else its account, so a line never has a hole. */
function issuerName(issuer: { name: string } | null, symbol: string | null, account: Address) {
  return issuer?.name ?? symbol ?? shortAddress(account);
}

/**
 * A gardener issuer's token in the shared pool (PRD-1323): its listing, then the holding limit
 * that caps it, with what the pool holds now. Nothing for a collective's token.
 */
function poolAdmissionRows(
  payment: NonNullable<Outcomes["payment"]>,
  formatMessage: FormatMessage
) {
  const { admission } = payment;
  if (!admission) return null;
  const label = formatMessage({
    id: "cockpit.garden.pool.outcome.payment.listing",
    defaultMessage: "Pool listing",
  });
  if (admission.status === "unread") {
    return (
      <FactRow
        label={label}
        value={formatMessage({
          id: "cockpit.garden.pool.outcome.payment.unread",
          defaultMessage: "Not read",
        })}
      />
    );
  }
  const status = formatMessage(POOL_STATUS[admission.status]);
  const decimals = payment.asset.decimals ?? 0;
  return (
    <>
      <FactRow
        data-pool-status={admission.status}
        label={label}
        value={
          admission.status === "delisted" ? (
            <FactValue
              value={status}
              note={formatMessage({
                id: "cockpit.garden.pool.outcome.payment.delistedNote",
                defaultMessage: "The pool takes in no more",
              })}
            />
          ) : (
            status
          )
        }
      />
      {admission.status === "setup" ? null : (
        <FactRow
          label={formatMessage({
            id: "cockpit.community.voucherIssuers.df.cap",
            defaultMessage: "Pool holding limit",
          })}
          value={
            <FactValue
              value={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.vouchers",
                  defaultMessage:
                    "{count, plural, one {# {issuer} voucher} other {# {issuer} vouchers}}",
                },
                {
                  count: voucherCount(admission.limit, decimals),
                  issuer: issuerName(payment.issuer, payment.asset.symbol, payment.issuerAccount),
                }
              )}
              note={formatMessage(
                {
                  id: "cockpit.garden.pool.outcome.payment.holding",
                  defaultMessage: "{count, number} in the pool now",
                },
                { count: voucherCount(admission.holding, decimals) }
              )}
            />
          }
        />
      )}
    </>
  );
}

/** A reward's amount: vouchers by their issuer, G$ in its own units. Never one sum of both. */
function rewardAmount(reward: CommitmentRewardOutcome, intl: IntlShape): string {
  if (reward.kind === "gd") {
    return intl.formatMessage(
      { id: "cockpit.garden.pool.reward.inGoodDollars", defaultMessage: "{amount} G$" },
      {
        amount: formatTokenAmount(reward.amount, reward.asset.decimals ?? 18, 2, intl.locale, true),
      }
    );
  }
  return intl.formatMessage(
    {
      id: "cockpit.garden.pool.voucher.vouchers",
      defaultMessage: "{count, plural, one {# {issuer} voucher} other {# {issuer} vouchers}}",
    },
    {
      count: voucherCount(reward.amount, reward.asset.decimals ?? 0),
      issuer: issuerName(reward.issuer, reward.asset.symbol, reward.funder),
    }
  );
}

/** Where a reward stands, in one line: the voucher's source and what it waits on, or the payout's. */
function rewardDetail(reward: CommitmentRewardOutcome, formatMessage: FormatMessage): string {
  const issuer = issuerName(reward.issuer, reward.asset.symbol, reward.funder);
  if (reward.kind === "gd") {
    switch (reward.status) {
      case "received":
        return formatMessage({
          id: "cockpit.garden.pool.outcome.gd.received",
          defaultMessage: "Paid on Celo",
        });
      case "delayed":
        return formatMessage({
          id: "cockpit.garden.pool.outcome.gd.delayed",
          defaultMessage:
            "The payout didn’t go through, and nothing was paid. Retrying sends the same payout once.",
        });
      case "after-work":
        return formatMessage({
          id: "cockpit.garden.pool.outcome.gd.afterWork",
          defaultMessage: "Paid on Celo by the payout plan once the work is confirmed",
        });
      default:
        return formatMessage({
          id: "cockpit.garden.pool.outcome.gd.onTheWay",
          defaultMessage: "The payout is running on Celo",
        });
    }
  }
  switch (reward.status) {
    case "preparing":
      return formatMessage({ id: "app.voucher.wait.rewardPreparingDetail" });
    case "unavailable":
      return formatMessage(STATUS.unavailable);
    case "received":
      return formatMessage(
        {
          id: "cockpit.garden.pool.outcome.voucher.received",
          defaultMessage: "Sent from {issuer}’s reserve",
        },
        { issuer }
      );
    case "waiting":
      return reward.shortOf === "reserve"
        ? formatMessage(
            {
              id: "cockpit.garden.pool.outcome.voucher.waitingReserve",
              defaultMessage: "Waits for {issuer} to top up its reserve. It isn’t lost.",
            },
            { issuer }
          )
        : formatMessage(
            {
              id: "cockpit.garden.pool.outcome.voucher.waitingAllowance",
              defaultMessage: "Waits for {issuer} to raise the allowance. It isn’t lost.",
            },
            { issuer }
          );
    case "delayed":
      return formatMessage({
        id: "cockpit.garden.pool.outcome.voucher.delayed",
        defaultMessage: "The delivery didn’t go through. It’s retried and sent only once.",
      });
    case "after-work":
      return formatMessage(
        {
          id: "cockpit.garden.pool.outcome.voucher.afterWork",
          defaultMessage: "From {issuer}’s reserve once the work is confirmed",
        },
        { issuer }
      );
    default:
      return formatMessage(
        {
          id: "cockpit.garden.pool.outcome.voucher.onTheWay",
          defaultMessage: "Being sent from {issuer}’s reserve",
        },
        { issuer }
      );
  }
}

/**
 * A promise's voucher outcomes in its inspector (PRD-1323, the stewards' view of `SReward` and
 * `SFunds`): a request's rewards, one fact row each with its own pill and line, the vouchers
 * first, and each receipt under Transaction details (D2); or an offer's voucher payment, with a
 * gardener issuer's pool listing and holding limit. A G$ reward's payout keeps its own controls in
 * G$ Payout; nothing here acts. Before the work is confirmed the section says nothing is set
 * aside: a promised reward draws on its source only then.
 */
export function CommitmentVoucherOutcomes({ outcomes }: { outcomes: Outcomes }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { rewards, payment } = outcomes;
  const label = (reward: CommitmentRewardOutcome) =>
    reward.kind === "gd"
      ? formatMessage({ id: "app.voucher.rw.sh.gd", defaultMessage: "G$" })
      : formatMessage({
          id: "cockpit.garden.pool.voucher.fact.vouchers",
          defaultMessage: "Vouchers",
        });

  return (
    <div className="space-y-5" data-component="CommitmentVoucherOutcomes">
      {rewards.length > 0 ? (
        <section
          className="space-y-3 border-t border-stroke-soft pt-4"
          aria-labelledby="commitment-rewards-title"
          data-state={outcomes.workFulfilled ? "fulfilled" : "after-work"}
        >
          <div>
            <AdminCardTitle as="h4" id="commitment-rewards-title">
              {formatMessage({
                id: "cockpit.garden.pool.outcome.title",
                defaultMessage: "Rewards",
              })}
            </AdminCardTitle>
            <p className="mt-1 type-meta text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.outcome.description",
                defaultMessage:
                  "Each reward is sent on its own, with its own receipt. Nothing is set aside before the work is confirmed.",
              })}
            </p>
          </div>
          <FactList frame="inset">
            {rewards.map((reward) => {
              const status = STATUS[reward.status];
              return (
                <FactRow
                  key={reward.id}
                  data-reward={reward.kind}
                  data-status={reward.status}
                  label={label(reward)}
                  value={
                    <FactValue
                      value={
                        <span className="flex flex-wrap items-center gap-2">
                          {rewardAmount(reward, intl)}
                          <StatusBadge variant={status.tone} size="sm" showIcon={false}>
                            {formatMessage({
                              id: status.id,
                              defaultMessage: status.defaultMessage,
                            })}
                          </StatusBadge>
                        </span>
                      }
                      note={rewardDetail(reward, formatMessage)}
                    />
                  }
                />
              );
            })}
          </FactList>
          <details className="type-meta text-text-soft">
            <summary className="cursor-pointer type-label-sm text-text-sub">
              {formatMessage({ id: "app.voucher.c.tech", defaultMessage: "Transaction details" })}
            </summary>
            <ul className="mt-2 space-y-1">
              {rewards.map((reward) => (
                <li key={reward.id} className="break-all">
                  {reward.receipt
                    ? formatMessage(
                        {
                          id: "cockpit.garden.pool.outcome.receipt",
                          defaultMessage: "{reward}: {receipt}",
                        },
                        { reward: label(reward), receipt: reward.receipt }
                      )
                    : formatMessage(
                        {
                          id: "cockpit.garden.pool.outcome.noReceipt",
                          defaultMessage: "{reward}: no receipt yet",
                        },
                        { reward: label(reward) }
                      )}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}
      {payment ? (
        <section
          className="space-y-3 border-t border-stroke-soft pt-4"
          aria-labelledby="commitment-voucher-payment-title"
        >
          <AdminCardTitle as="h4" id="commitment-voucher-payment-title">
            {formatMessage({
              id: "cockpit.garden.pool.outcome.payment.title",
              defaultMessage: "Voucher Payment",
            })}
          </AdminCardTitle>
          <FactList frame="inset">
            <FactRow
              label={formatMessage({
                id: "cockpit.garden.pool.outcome.payment.booking",
                defaultMessage: "A booking takes",
              })}
              value={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.vouchers",
                  defaultMessage:
                    "{count, plural, one {# {issuer} voucher} other {# {issuer} vouchers}}",
                },
                {
                  count: voucherCount(payment.units, payment.asset.decimals ?? 0),
                  issuer: issuerName(payment.issuer, payment.asset.symbol, payment.issuerAccount),
                }
              )}
            />
            <FactRow
              label={formatMessage({
                id: "cockpit.garden.pool.voucher.fact.terms",
                defaultMessage: "Terms",
              })}
              value={formatMessage(
                { id: "cockpit.garden.pool.voucher.version", defaultMessage: "Version {version}" },
                { version: payment.revision.toString() }
              )}
            />
            {poolAdmissionRows(payment, formatMessage)}
          </FactList>
        </section>
      ) : null}
    </div>
  );
}
