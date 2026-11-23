import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import {
  promiseRewardLegsOf,
  type RewardPayOutcome,
  rewardShareRecipientsOf,
  rewardShareSettled,
  rewardSharesOwed,
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
  symbol: string;
  decimals: number;
  /** The reward payer is deployed on this chain. */
  payerAvailable: boolean;
  /** The G$ payout plan is finalized, which fixes who gets what share; null until it reads. */
  splitFixed: boolean | null;
  /** The viewer stewards the garden that pays. */
  canPay: boolean;
  /** Whoever is reading: a share of their own is theirs to keep, never sent. */
  viewer: Address | null;
  isOnline: boolean;
  readFailed: boolean;
  isPaying: boolean;
  onPay: () => void;
}

/** Where one share stands, as its row reads. */
const SHARE_MESSAGE = {
  paid: { id: "hub.garden.pool.walletShares.sharePaid", defaultMessage: "{amount}, paid" },
  own: {
    id: "hub.garden.pool.walletShares.shareOwn",
    defaultMessage: "{amount}, your own share, nothing to send",
  },
  checking: {
    id: "hub.garden.pool.walletShares.shareChecking",
    defaultMessage: "{amount}, checking",
  },
  kept: {
    id: "hub.garden.pool.walletShares.shareKept",
    defaultMessage: "{amount}, kept by the steward who paid the others",
  },
  owed: { id: "hub.garden.pool.walletShares.shareOwed", defaultMessage: "{amount}, not paid yet" },
} as const;

/**
 * The USDC part of a kept promise's reward, paid from the steward's own wallet
 * (PRD-1556). It is split by the payment weights the G$ payout plan fixed, so it
 * waits for that plan to be finalized. Each share is paid once: the reward payer
 * refuses a share it has already recorded. Paying asks for up to two signatures,
 * an approval for exactly what is owed and the payment itself.
 */
export function CommitmentUsdcShares({
  shares,
  symbol,
  decimals,
  payerAvailable,
  splitFixed,
  canPay,
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
  const isOwn = (share: RewardShareState) =>
    Boolean(viewer) && share.recipient.toLowerCase() === viewer?.toLowerCase();
  // What the viewer would pay: never their own share, nor one a steward kept while paying the rest.
  const owed = rewardSharesOwed(shares, viewer);
  const owedTotal = owed.reduce((sum, share) => sum + share.amount, 0n);
  // Paid once every share is settled: paid, or kept by a steward who paid the rest. A viewer's
  // own unpaid share counts only once they have paid the others, never just for being theirs.
  const allPaid = shares.length > 0 && shares.every((share) => rewardShareSettled(share, shares));
  const shareState = (share: RewardShareState) =>
    share.paidBy
      ? "paid"
      : isOwn(share)
        ? "own"
        : share.paidBy === undefined
          ? "checking"
          : rewardShareSettled(share, shares)
            ? "kept"
            : "owed";
  const title = formatMessage(
    { id: "hub.garden.pool.walletShares.title", defaultMessage: "{symbol} from Your Wallet" },
    { symbol }
  );

  let notice: string | null = null;
  if (!payerAvailable) {
    notice = formatMessage({
      id: "hub.garden.pool.walletShares.payerUnavailable",
      defaultMessage: "Paying this part from the app isn't available on this network yet.",
    });
  } else if (splitFixed === false) {
    notice = formatMessage({
      id: "hub.garden.pool.walletShares.waitsForPlan",
      defaultMessage:
        "This part is split the same way as the G$ payout. Create and finalize the G$ payout plan first.",
    });
  } else if (splitFixed === true && shares.length === 0) {
    notice = formatMessage({
      id: "hub.garden.pool.walletShares.nobodyToPay",
      defaultMessage:
        "The G$ payout plan gives no one a share, so there's nothing to pay in this part.",
    });
  }

  return (
    <section
      className="space-y-3 border-t border-stroke-soft pt-4"
      aria-labelledby="commitment-wallet-shares-title"
      data-component="CommitmentUsdcShares"
      data-state={allPaid ? "paid" : owed.length > 0 ? "owed" : "waiting"}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <AdminCardTitle as="h4" id="commitment-wallet-shares-title">
            {title}
          </AdminCardTitle>
          <p className="mt-1 type-body text-text-soft">
            {formatMessage({
              id: "hub.garden.pool.walletShares.description",
              defaultMessage:
                "Matched to the G$ reward and paid from your own wallet. Each share can be paid only once.",
            })}
          </p>
        </div>
        {allPaid ? (
          <StatusBadge variant="success" size="sm">
            {formatMessage({ id: "hub.garden.pool.walletShares.allPaid", defaultMessage: "Paid" })}
          </StatusBadge>
        ) : null}
      </div>

      {notice ? <Alert variant="info">{notice}</Alert> : null}
      {readFailed ? (
        <Alert variant="error">
          {formatMessage({
            id: "hub.garden.pool.walletShares.readError",
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
              value={
                readFailed
                  ? amountText(share.amount)
                  : formatMessage(SHARE_MESSAGE[shareState(share)], {
                      amount: amountText(share.amount),
                    })
              }
            />
          ))}
        </FactList>
      ) : null}

      {canPay && payerAvailable && splitFixed === true && owed.length > 0 ? (
        <div className="space-y-2">
          <Button
            type="button"
            emphasis="primary"
            size="sm"
            loading={isPaying}
            disabled={!isOnline || readFailed}
            onClick={onPay}
          >
            {formatMessage(
              { id: "hub.garden.pool.walletShares.pay", defaultMessage: "Pay {amount}" },
              { amount: amountText(owedTotal) }
            )}
          </Button>
          <p className="type-meta text-text-soft">
            {formatMessage({
              id: "hub.garden.pool.walletShares.signatures",
              defaultMessage:
                "Asks for up to two signatures: approve exactly this amount, then pay every share at once.",
            })}
          </p>
        </div>
      ) : null}
    </section>
  );
}

/** Reads the promise's USDC part and its shares, and pays what is owed when the steward asks. */
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
    (leg) => leg.rail === "steward-wallet"
  );
  // Until the settlement read answers, nobody can tell whether the plan is finalized.
  const splitFixed = settlement.chainRead === "ready" ? settlement.plan?.finalized === true : null;
  const rewardShares = useRewardShares({
    chainId: settlement.chainId,
    commitmentId: commitment.commitmentId,
    legs,
    // Split as the G$ plan pays: a garden that took up a Request, or each contributor by weight.
    recipients:
      splitFixed === true && settlement.plan
        ? rewardShareRecipientsOf(settlement.plan, settlement.rows)
        : [],
  });
  const [leg] = legs;
  if (!leg) return null;
  // One section per payable part; the pilot declares only USDC.
  const legShares = rewardShares.shares.filter(
    (share) => share.token.toLowerCase() === leg.token.toLowerCase()
  );

  const pay = async () => {
    const outcome: RewardPayOutcome = await rewardShares.payOwed(leg.token);
    if (outcome.status === "paid") {
      toastService.success({
        title: formatMessage({
          id: "hub.garden.pool.walletShares.toast.paid",
          defaultMessage: "Shares paid",
        }),
        message: `${outcome.transactionHash.slice(0, 10)}…`,
      });
    } else if (outcome.status === "approval-pending") {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.walletShares.toast.approvalPending",
          defaultMessage: "Approval sent, waiting on your wallet",
        }),
        message: formatMessage({
          id: "hub.garden.pool.walletShares.toast.approvalPendingHint",
          defaultMessage: "Pay again once the approval has run.",
        }),
      });
    } else if (outcome.status === "unconfirmed") {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.walletShares.toast.unconfirmed",
          defaultMessage: "Sent, not confirmed yet",
        }),
        message: formatMessage({
          id: "hub.garden.pool.walletShares.toast.unconfirmedHint",
          defaultMessage: "The shares show as paid once the payment lands.",
        }),
      });
    } else if (
      outcome.status === "refused-before-asking" &&
      outcome.refusal === "insufficient-balance"
    ) {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.walletShares.toast.balance",
          defaultMessage: "Your wallet doesn't hold enough to pay every share",
        }),
      });
    } else if (outcome.status === "refused-before-asking" && outcome.refusal === "already-paid") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.walletShares.toast.alreadyPaid",
          defaultMessage: "A share is already paid. Read again before paying.",
        }),
      });
    } else if (outcome.status !== "not-paid" || outcome.miss !== "declined") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.walletShares.toast.failed",
          defaultMessage: "The shares weren't paid",
        }),
      });
    }
  };

  return (
    <CommitmentUsdcShares
      shares={legShares}
      symbol={leg.symbol}
      decimals={leg.decimals}
      payerAvailable={rewardShares.payer !== null}
      splitFixed={splitFixed}
      canPay={settlement.authority.isPayerSteward}
      viewer={settlement.viewer ?? null}
      isOnline={settlement.isOnline}
      readFailed={rewardShares.readFailed}
      isPaying={rewardShares.isPaying}
      onPay={() => void pay()}
    />
  );
}
