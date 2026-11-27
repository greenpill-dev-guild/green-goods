/**
 * What the Hub tells a steward once their step towards paying a garden Safe's USDC shares ends:
 * their approval or the payment itself, or the signer update that comes first.
 */
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type {
  RewardPayOutcome,
  RewardSafeSyncOutcome,
} from "@green-goods/shared/commitment-pooling";
import type { IntlShape } from "react-intl";

type FormatMessage = IntlShape["formatMessage"];

/** Tells the steward how their approval or payment ended. A declined signature needs no word. */
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
}

/** Tells the steward how their signer update ended. A declined first signature needs no word. */
export function toastRewardSyncOutcome(
  outcome: RewardSafeSyncOutcome,
  formatMessage: FormatMessage
) {
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
}
