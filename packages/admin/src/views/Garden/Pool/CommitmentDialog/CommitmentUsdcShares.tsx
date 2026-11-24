import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import {
  promiseRewardLegsOf,
  rewardBeneficiarySafeMissing,
  type RewardPayOutcome,
  type RewardSafePaymentRead,
  rewardShareRecipientsOf,
  type RewardShareState,
  useCommitmentMetadataFor,
  useRewardShares,
} from "@green-goods/shared/commitment-pooling";
import type { CommitmentSettlementController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { shortAddress } from "../poolFundingPresentation";

export interface CommitmentUsdcSharesProps {
  /** Each gardener's share of the USDC part, with whether the payer has recorded it as paid. */
  shares: readonly RewardShareState[];
  /** The shares still owed, once every share's paid state has answered. */
  owed: readonly RewardShareState[];
  symbol: string;
  decimals: number;
  /** The reward payer is deployed on this chain. */
  payerAvailable: boolean;
  /** The paying garden's Safe on this chain, which holds and pays the part; null when none is recorded. */
  safe: Address | null;
  /** A Request a garden took up pays that garden's Safe, and the garden has none recorded yet. */
  beneficiarySafeMissing: boolean;
  /** The G$ payout plan is finalized, which fixes who gets what share; null until it reads. */
  splitFixed: boolean | null;
  /** Where the Safe's payment of the owed shares stands; null until it reads or with nothing owed. */
  payment: RewardSafePaymentRead | null;
  paymentReading: boolean;
  paymentReadFailed: boolean;
  /** Whoever is reading, who approves or pays only as one of the Safe's owners. */
  viewer: Address | null;
  isOnline: boolean;
  readFailed: boolean;
  isPaying: boolean;
  /** The owner pressed Approve, or Pay when their call completes the approvals. */
  onPay: (intent: "approve" | "pay") => void;
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b) && a?.toLowerCase() === b?.toLowerCase();

/**
 * The USDC part of a kept promise's reward, held and paid by the garden's Safe (PRD-1556). It is
 * split by the payment weights the G$ payout plan fixed, so it waits for that plan to be
 * finalized. Paying is one Safe transaction that approves exactly the owed total and pays every
 * share; the Safe's owners approve it from their own accounts, and the owner whose approval
 * completes the threshold runs it. Each share is paid once: the reward payer refuses a share it
 * has already recorded.
 */
export function CommitmentUsdcShares({
  shares,
  owed,
  symbol,
  decimals,
  payerAvailable,
  safe,
  beneficiarySafeMissing,
  splitFixed,
  payment,
  paymentReading,
  paymentReadFailed,
  viewer,
  isOnline,
  readFailed,
  isPaying,
  onPay,
}: CommitmentUsdcSharesProps) {
  const { formatMessage, locale } = useIntl();
  const amountText = (amount: bigint) =>
    formatMessage(
      { id: "app.commitment.reward.tokenAmount", defaultMessage: "{amount} {symbol}" },
      { amount: formatTokenAmount(amount, decimals, 2, locale), symbol }
    );
  const owedTotal = owed.reduce((sum, share) => sum + share.amount, 0n);
  const allPaid = shares.length > 0 && shares.every((share) => Boolean(share.paidBy));
  const shareValue = (share: RewardShareState) => {
    const amount = amountText(share.amount);
    if (share.paidBy) {
      return same(share.paidBy, safe)
        ? formatMessage(
            {
              id: "hub.garden.pool.safeShares.sharePaidByGarden",
              defaultMessage: "{amount}, paid by the garden",
            },
            { amount }
          )
        : formatMessage(
            { id: "hub.garden.pool.safeShares.sharePaid", defaultMessage: "{amount}, paid" },
            { amount }
          );
    }
    return share.paidBy === undefined
      ? formatMessage(
          { id: "hub.garden.pool.safeShares.shareChecking", defaultMessage: "{amount}, checking" },
          { amount }
        )
      : formatMessage(
          { id: "hub.garden.pool.safeShares.shareOwed", defaultMessage: "{amount}, not paid yet" },
          { amount }
        );
  };
  const title = formatMessage(
    { id: "hub.garden.pool.safeShares.title", defaultMessage: "{symbol} from the Garden's Safe" },
    { symbol }
  );

  let notice: string | null = null;
  if (!payerAvailable) {
    notice = formatMessage({
      id: "hub.garden.pool.safeShares.payerUnavailable",
      defaultMessage: "Paying this part from the app isn't available on this network yet.",
    });
  } else if (!safe) {
    notice = formatMessage(
      {
        id: "hub.garden.pool.safeShares.noSafe",
        defaultMessage: "This garden has no Safe on this network to pay {symbol} from yet.",
      },
      { symbol }
    );
  } else if (splitFixed === false) {
    notice = formatMessage({
      id: "hub.garden.pool.safeShares.waitsForPlan",
      defaultMessage:
        "This part is split the same way as the G$ payout. Create and finalize the G$ payout plan first.",
    });
  } else if (splitFixed === true && beneficiarySafeMissing) {
    notice = formatMessage(
      {
        id: "hub.garden.pool.safeShares.beneficiaryNoSafe",
        defaultMessage:
          "The garden that took this up has no Safe on this network to receive {symbol} yet.",
      },
      { symbol }
    );
  } else if (splitFixed === true && shares.length === 0) {
    notice = formatMessage({
      id: "hub.garden.pool.safeShares.nobodyToPay",
      defaultMessage:
        "The G$ payout plan gives no one a share, so there's nothing to pay in this part.",
    });
  }

  const canOffer = payerAvailable && safe !== null && splitFixed === true && owed.length > 0;
  const ready = payment?.status === "ready" ? payment : null;
  const viewerIsOwner = Boolean(ready?.owners.some((owner) => same(owner, viewer)));
  const viewerApproved = Boolean(ready?.approvedBy.some((owner) => same(owner, viewer)));
  const othersApproved = ready
    ? ready.approvedBy.filter((owner) => !same(owner, viewer)).length
    : 0;
  // The viewer's call runs the payment when, with theirs, enough owners have approved it.
  const viewerCompletes = Boolean(ready) && othersApproved + 1 >= (ready?.threshold ?? 1);
  const balanceShort = payment?.status === "refused" && payment.refusal === "insufficient-balance";
  const approvalsUnreadable =
    paymentReadFailed || (payment?.status === "refused" && payment.refusal === "unreadable");
  // A share was paid since the list was read; the shares read again, and the list catches up.
  const paidSinceRead = payment?.status === "refused" && payment.refusal === "already-paid";

  return (
    <section
      className="space-y-3 border-t border-stroke-soft pt-4"
      aria-labelledby="commitment-safe-shares-title"
      data-component="CommitmentUsdcShares"
      data-state={allPaid ? "paid" : owed.length > 0 ? "owed" : "waiting"}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <AdminCardTitle as="h4" id="commitment-safe-shares-title">
            {title}
          </AdminCardTitle>
          <p className="mt-1 type-body text-text-soft">
            {formatMessage({
              id: "hub.garden.pool.safeShares.description",
              defaultMessage:
                "Matched to the G$ reward and paid from this garden's Safe once its owners approve. Each share can be paid only once.",
            })}
          </p>
        </div>
        {allPaid ? (
          <StatusBadge variant="success" size="sm">
            {formatMessage({ id: "hub.garden.pool.safeShares.allPaid", defaultMessage: "Paid" })}
          </StatusBadge>
        ) : null}
      </div>

      {notice ? <Alert variant="info">{notice}</Alert> : null}
      {readFailed ? (
        <Alert variant="error">
          {formatMessage({
            id: "hub.garden.pool.safeShares.readError",
            defaultMessage:
              "Couldn't read which shares are paid. Nothing can be paid until it reads.",
          })}
        </Alert>
      ) : null}

      {payerAvailable && shares.length > 0 ? (
        <FactList>
          {shares.map((share) => (
            <FactRow
              key={share.shareId}
              label={
                <span title={share.recipient}>{shortAddress(share.recipient as Address)}</span>
              }
              value={readFailed ? amountText(share.amount) : shareValue(share)}
            />
          ))}
        </FactList>
      ) : null}

      {canOffer ? (
        <div className="space-y-2" data-payment={ready ? "ready" : (payment?.status ?? "reading")}>
          {approvalsUnreadable ? (
            <Alert variant="error">
              {formatMessage({
                id: "hub.garden.pool.safeShares.paymentReadError",
                defaultMessage:
                  "Couldn't read the Safe's approvals for this payment. Nothing can be approved until it reads.",
              })}
            </Alert>
          ) : null}
          {paidSinceRead ? (
            <Alert variant="info">
              {formatMessage({
                id: "hub.garden.pool.safeShares.paidSinceRead",
                defaultMessage:
                  "A share was paid since this list was read. The list is updating; if it doesn't, close and reopen the promise.",
              })}
            </Alert>
          ) : null}
          {balanceShort ? (
            <Alert variant="warning">
              {formatMessage(
                {
                  id: "hub.garden.pool.safeShares.balanceShort",
                  defaultMessage:
                    "The garden's Safe holds less than {amount}. Add {symbol} to the Safe before paying.",
                },
                { amount: amountText(owedTotal), symbol }
              )}
            </Alert>
          ) : null}
          {ready ? (
            <p className="type-body text-text-sub" title={ready.transaction.safe}>
              {formatMessage(
                {
                  id: "hub.garden.pool.safeShares.approvals",
                  defaultMessage:
                    "{approvals} of {threshold} Safe owners have approved this payment.",
                },
                { approvals: ready.approvedBy.length, threshold: ready.threshold }
              )}
            </p>
          ) : null}
          {ready && !viewerIsOwner ? (
            <Alert variant="info">
              {formatMessage({
                id: "hub.garden.pool.safeShares.notOwner",
                defaultMessage: "Only an owner of this garden's Safe can approve this payment.",
              })}
            </Alert>
          ) : null}
          {ready && viewerIsOwner && viewerApproved && !viewerCompletes ? (
            <p className="type-meta text-text-soft">
              {formatMessage({
                id: "hub.garden.pool.safeShares.viewerApproved",
                defaultMessage:
                  "You've approved. It pays once enough of the Safe's owners approve.",
              })}
            </p>
          ) : null}
          {(payment === null && paymentReading) ||
          (ready && viewerIsOwner && (!viewerApproved || viewerCompletes)) ? (
            <>
              <Button
                type="button"
                emphasis="primary"
                size="sm"
                loading={isPaying || paymentReading}
                disabled={!isOnline || readFailed || !ready}
                onClick={() => onPay(viewerCompletes ? "pay" : "approve")}
              >
                {formatMessage(
                  viewerCompletes
                    ? { id: "hub.garden.pool.safeShares.pay", defaultMessage: "Pay {amount}" }
                    : {
                        id: "hub.garden.pool.safeShares.approve",
                        defaultMessage: "Approve Payment of {amount}",
                      },
                  { amount: amountText(owedTotal) }
                )}
              </Button>
              <p className="type-meta text-text-soft">
                {formatMessage(
                  viewerCompletes
                    ? {
                        id: "hub.garden.pool.safeShares.payNote",
                        defaultMessage:
                          "One signature from your account pays every share at once from the garden's Safe.",
                      }
                    : {
                        id: "hub.garden.pool.safeShares.approveNote",
                        defaultMessage:
                          "One signature from your account. The payment runs once enough of the Safe's owners approve.",
                      }
                )}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Reads the promise's USDC part and its shares, and pays what is owed when an owner asks. */
export function CommitmentUsdcSharesSection({
  commitment,
  settlement,
}: {
  commitment: CommitmentReadModel;
  settlement: CommitmentSettlementController;
}) {
  const { formatMessage } = useIntl();
  const metadata = useCommitmentMetadataFor(commitment);
  const legs = (promiseRewardLegsOf(commitment, metadata)?.legs ?? []).filter(
    (leg) => leg.rail === "garden-safe"
  );
  // One section per payable part; the pilot declares only USDC.
  const [leg] = legs;
  // Until the settlement read answers, nobody can tell whether the plan is finalized.
  const splitFixed = settlement.chainRead === "ready" ? settlement.plan?.finalized === true : null;
  const rewardShares = useRewardShares({
    chainId: settlement.chainId,
    commitmentId: commitment.commitmentId,
    legs,
    // Split as the G$ plan pays: a garden that took up a Request, through its own Safe, or each
    // contributor by weight.
    recipients:
      splitFixed === true && settlement.plan
        ? rewardShareRecipientsOf(settlement.plan, settlement.rows, settlement.chainId)
        : [],
    garden: settlement.payerGarden,
    token: leg?.token ?? null,
  });
  if (!leg) return null;
  const legShares = rewardShares.shares.filter(
    (share) => share.token.toLowerCase() === leg.token.toLowerCase()
  );

  const pay = async (intent: "approve" | "pay") => {
    const outcome: RewardPayOutcome = await rewardShares.payOwed(intent);
    if (outcome.status === "paid") {
      toastService.success({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.paid",
          defaultMessage: "Shares paid",
        }),
        message: `${outcome.transactionHash.slice(0, 10)}…`,
      });
    } else if (outcome.status === "approved") {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.approved",
          defaultMessage: "Approval sent",
        }),
        message: formatMessage(
          {
            id: "hub.garden.pool.safeShares.toast.approvedHint",
            defaultMessage:
              "{approvals} of {threshold} Safe owners have approved. It pays once enough approve.",
          },
          { approvals: outcome.approvals, threshold: outcome.threshold }
        ),
      });
    } else if (outcome.status === "awaiting-owners") {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.alreadyApproved",
          defaultMessage: "You've already approved this payment",
        }),
      });
    } else if (outcome.status === "unconfirmed") {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.unconfirmed",
          defaultMessage: "Sent, not confirmed yet",
        }),
        message: formatMessage({
          id: "hub.garden.pool.safeShares.toast.unconfirmedHint",
          defaultMessage: "The shares show as paid once the payment lands.",
        }),
      });
    } else if (
      outcome.status === "refused-before-asking" &&
      outcome.refusal === "insufficient-balance"
    ) {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.balance",
          defaultMessage: "The garden's Safe doesn't hold enough to pay every share",
        }),
      });
    } else if (outcome.status === "refused-before-asking" && outcome.refusal === "already-paid") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.alreadyPaid",
          defaultMessage: "A share is already paid. Read again before paying.",
        }),
      });
    } else if (
      outcome.status === "refused-before-asking" &&
      outcome.refusal === "approvals-changed"
    ) {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.approvalsChanged",
          defaultMessage: "The Safe's approvals changed. Check the payment again.",
        }),
      });
    } else if (outcome.status === "refused-before-asking" && outcome.refusal === "not-an-owner") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.notOwner",
          defaultMessage: "Only an owner of this garden's Safe can approve this payment",
        }),
      });
    } else if (outcome.status !== "not-paid" || outcome.miss !== "declined") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.failed",
          defaultMessage: "The shares weren't paid",
        }),
      });
    }
  };

  return (
    <CommitmentUsdcShares
      shares={legShares}
      owed={rewardShares.owed}
      symbol={leg.symbol}
      decimals={leg.decimals}
      payerAvailable={rewardShares.payer !== null}
      safe={rewardShares.safe}
      beneficiarySafeMissing={
        splitFixed === true && settlement.plan
          ? rewardBeneficiarySafeMissing(settlement.plan, settlement.chainId)
          : false
      }
      splitFixed={splitFixed}
      payment={rewardShares.payment}
      paymentReading={rewardShares.paymentReading}
      paymentReadFailed={rewardShares.paymentReadFailed}
      viewer={rewardShares.account}
      isOnline={settlement.isOnline}
      readFailed={rewardShares.readFailed}
      isPaying={rewardShares.isPaying}
      onPay={(intent) => void pay(intent)}
    />
  );
}
