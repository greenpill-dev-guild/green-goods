import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type { RewardPayOutcome } from "@green-goods/shared/commitment-pooling";
import type { IntlShape } from "react-intl";

/** What the Hub tells an owner once their approval of, or run of, a garden Safe's payment ends. */
type FormatMessage = IntlShape["formatMessage"];

/** Tells the owner how their approval or payment ended. A declined signature needs no word. */
export function toastRewardPayOutcome(outcome: RewardPayOutcome, formatMessage: FormatMessage) {
  if (outcome.status === "paid") {
    toastService.success({
      title: formatMessage({
        id: "hub.garden.pool.safeShares.toast.paid",
        defaultMessage: "Shares paid",
      }),
      message: `${outcome.transactionHash.slice(0, 10)}…`,
    });
  } else if (outcome.status === "approved" && !outcome.confirmed) {
    toastService.info({
      title: formatMessage({
        id: "hub.garden.pool.safeShares.toast.approvalUnconfirmed",
        defaultMessage: "Approval sent, not confirmed yet",
      }),
      message: formatMessage({
        id: "hub.garden.pool.safeShares.toast.approvalUnconfirmedHint",
        defaultMessage: "It counts towards the payment once it lands.",
      }),
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
            "{approvals} of {threshold} Safe owners have approved. Once enough approve, any owner presses Pay.",
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
}
