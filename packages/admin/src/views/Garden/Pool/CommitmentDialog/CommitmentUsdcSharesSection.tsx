import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import {
  promiseRewardLegsOf,
  rewardBeneficiarySafeMissing,
  type RewardPayOutcome,
  type RewardSafeSyncOutcome,
  rewardShareRecipientsOf,
  useCommitmentMetadataFor,
  useRewardShares,
} from "@green-goods/shared/commitment-pooling";
import type { CommitmentSettlementController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useIntl } from "react-intl";
import { CommitmentUsdcShares } from "./CommitmentUsdcShares";

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
    } else if (outcome.status === "refused-before-asking" && outcome.refusal === "needs-sync") {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.needsSync",
          defaultMessage: "Update the Safe's signers first",
        }),
      });
    } else if (outcome.status === "refused-before-asking" && outcome.refusal === "not-a-steward") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.notSteward",
          defaultMessage: "Only a steward of this garden can pay from its Safe",
        }),
      });
    } else if (outcome.status === "unsponsored") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.unsponsored",
          defaultMessage: "Green Goods couldn't cover the network fee for this step",
        }),
        message: formatMessage({
          id: "hub.garden.pool.safeShares.toast.unsponsoredHint",
          defaultMessage:
            "Nothing was sent. Try again later, and tell the Green Goods team if it keeps happening.",
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

  const sync = async () => {
    const outcome: RewardSafeSyncOutcome = await rewardShares.syncSigners();
    if (outcome.status === "synced" && !outcome.confirmed) {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.syncUnconfirmed",
          defaultMessage: "Update sent, not confirmed yet",
        }),
        message: formatMessage({
          id: "hub.garden.pool.safeShares.toast.syncUnconfirmedHint",
          defaultMessage: "The signers show as updated once it lands.",
        }),
      });
    } else if (outcome.status === "synced") {
      toastService.success({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.synced",
          defaultMessage: "Safe signers updated",
        }),
        message: formatMessage({
          id: "hub.garden.pool.safeShares.toast.syncedHint",
          defaultMessage: "Approve the payment next.",
        }),
      });
    } else if (outcome.status === "refused-before-asking" && outcome.refusal === "not-a-steward") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.notSteward",
          defaultMessage: "Only a steward of this garden can pay from its Safe",
        }),
      });
    } else if (outcome.status === "unsponsored") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.unsponsored",
          defaultMessage: "Green Goods couldn't cover the network fee for this step",
        }),
        message: outcome.partly
          ? formatMessage({
              id: "hub.garden.pool.safeShares.toast.unsponsoredPartlyHint",
              defaultMessage:
                "Part of the update went out and the rest wasn't sent. Try again later, and tell the Green Goods team if it keeps happening.",
            })
          : formatMessage({
              id: "hub.garden.pool.safeShares.toast.unsponsoredHint",
              defaultMessage:
                "Nothing was sent. Try again later, and tell the Green Goods team if it keeps happening.",
            }),
      });
    } else if (outcome.status === "not-synced" && outcome.partly) {
      toastService.info({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.syncPartly",
          defaultMessage: "Part of the update went out",
        }),
        message: formatMessage({
          id: "hub.garden.pool.safeShares.toast.syncPartlyHint",
          defaultMessage: "Check the Safe's signers, then update what's left.",
        }),
      });
    } else if (outcome.status !== "not-synced" || outcome.miss !== "declined") {
      toastService.error({
        title: formatMessage({
          id: "hub.garden.pool.safeShares.toast.syncFailed",
          defaultMessage: "The Safe's signers weren't updated",
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
      onSync={() => void sync()}
    />
  );
}
