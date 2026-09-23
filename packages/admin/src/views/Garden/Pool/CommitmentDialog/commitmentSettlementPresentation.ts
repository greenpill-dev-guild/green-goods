import type {
  SettlementActionBlocker,
  SettlementDisplayState,
  SettlementEligibilityBlocker,
  SettlementNextAction,
  SettlementPayoutKind,
  SettlementPlanStatus,
  SettlementStep,
  SettlementStepId,
} from "@green-goods/shared/modules/commitment-pooling/settlement-workflow";
import type { IntlShape } from "react-intl";

type Message = { id: string; defaultMessage: string };

export function payoutKindLabel(kind: SettlementPayoutKind, intl: IntlShape): string {
  return intl.formatMessage(
    kind === "GARDEN_BENEFICIARY"
      ? {
          id: "cockpit.garden.pool.settlement.kind.beneficiary",
          defaultMessage: "Garden beneficiary payout",
        }
      : {
          id: "cockpit.garden.pool.settlement.kind.contributor",
          defaultMessage: "Contributor consideration",
        }
  );
}

const STEP_LABELS: Record<SettlementStepId, Message> = {
  "create-plan": {
    id: "cockpit.garden.pool.settlement.step.create-plan",
    defaultMessage: "Create payout plan",
  },
  "contributor-split": {
    id: "cockpit.garden.pool.settlement.step.contributor-split",
    defaultMessage: "Contributor split (default from recognition)",
  },
  "finalize-plan": {
    id: "cockpit.garden.pool.settlement.step.finalize-plan",
    defaultMessage: "Finalize payout plan",
  },
  "prepare-payout": {
    id: "cockpit.garden.pool.settlement.step.prepare-payout",
    defaultMessage: "Prepare payout",
  },
  dispatch: {
    id: "cockpit.garden.pool.settlement.step.dispatch",
    defaultMessage: "Dispatch to Celo",
  },
  acknowledgement: {
    id: "cockpit.garden.pool.settlement.step.acknowledgement",
    defaultMessage: "Celo acknowledgement",
  },
};

export function stepLabel(id: SettlementStepId, intl: IntlShape): string {
  return intl.formatMessage(STEP_LABELS[id]);
}

export type StepChip = { label: string; variant: "success" | "warning" | "neutral" };

export function stepChip(step: SettlementStep, intl: IntlShape): StepChip {
  if (step.status === "done") {
    return {
      label: intl.formatMessage({
        id: "cockpit.garden.pool.settlement.stepStatus.done",
        defaultMessage: "Done",
      }),
      variant: "success",
    };
  }
  if (step.status === "current" && step.blockers.length > 0) {
    return {
      label: intl.formatMessage({
        id: "cockpit.garden.pool.settlement.stepStatus.blocked",
        defaultMessage: "Blocked",
      }),
      variant: "warning",
    };
  }
  if (step.status === "current") {
    return {
      label: intl.formatMessage({
        id: "cockpit.garden.pool.settlement.stepStatus.current",
        defaultMessage: "Next",
      }),
      variant: "neutral",
    };
  }
  return {
    label: intl.formatMessage({
      id: "cockpit.garden.pool.settlement.stepStatus.upcoming",
      defaultMessage: "Later",
    }),
    variant: "neutral",
  };
}

const PLAN_STATUS_LABELS: Record<SettlementPlanStatus, Message> = {
  DRAFT: { id: "cockpit.garden.pool.settlement.planStatus.DRAFT", defaultMessage: "Draft" },
  PENDING: { id: "cockpit.garden.pool.settlement.planStatus.PENDING", defaultMessage: "Pending" },
  PARTIAL: { id: "cockpit.garden.pool.settlement.planStatus.PARTIAL", defaultMessage: "Partial" },
  COMPLETE: {
    id: "cockpit.garden.pool.settlement.planStatus.COMPLETE",
    defaultMessage: "Complete",
  },
  FAILED: { id: "cockpit.garden.pool.settlement.planStatus.FAILED", defaultMessage: "Failed" },
};

export function planStatusLabel(status: SettlementPlanStatus, intl: IntlShape): string {
  return intl.formatMessage(PLAN_STATUS_LABELS[status]);
}

const DISPLAY_LABELS: Record<
  SettlementDisplayState,
  Message & { variant: "success" | "warning" | "error" | "neutral" }
> = {
  queued: {
    id: "cockpit.garden.pool.settlement.display.queued",
    defaultMessage: "Queued",
    variant: "neutral",
  },
  dispatched: {
    id: "cockpit.garden.pool.settlement.display.dispatched",
    defaultMessage: "Dispatched",
    variant: "neutral",
  },
  "acknowledgement-pending": {
    id: "cockpit.garden.pool.settlement.display.acknowledgement-pending",
    defaultMessage: "Awaiting acknowledgement",
    variant: "warning",
  },
  "delivery-delayed": {
    id: "cockpit.garden.pool.settlement.display.delivery-delayed",
    defaultMessage: "Delivery delayed",
    variant: "warning",
  },
  confirmed: {
    id: "cockpit.garden.pool.settlement.display.confirmed",
    defaultMessage: "Confirmed",
    variant: "success",
  },
  failed: {
    id: "cockpit.garden.pool.settlement.display.failed",
    defaultMessage: "Failed",
    variant: "error",
  },
  cancelled: {
    id: "cockpit.garden.pool.settlement.display.cancelled",
    defaultMessage: "Cancelled",
    variant: "neutral",
  },
  unknown: {
    id: "cockpit.garden.pool.settlement.display.unknown",
    defaultMessage: "Unknown",
    variant: "neutral",
  },
};

export function displayChip(state: SettlementDisplayState, intl: IntlShape) {
  const { variant, ...message } = DISPLAY_LABELS[state];
  return { label: intl.formatMessage(message), variant };
}

const BLOCKER_MESSAGES: Record<SettlementActionBlocker, Message> = {
  "wallet-disconnected": {
    id: "cockpit.garden.pool.settlement.blocker.wallet-disconnected",
    defaultMessage: "Connect a wallet to act.",
  },
  offline: {
    id: "cockpit.garden.pool.settlement.blocker.offline",
    defaultMessage: "Needs a connection. Settlement calls are sent straight to the chain.",
  },
  "missing-payer-steward": {
    id: "cockpit.garden.pool.settlement.blocker.missing-payer-steward",
    defaultMessage: "Only a steward or owner of the paying garden can run the payout plan.",
  },
  "missing-operator": {
    id: "cockpit.garden.pool.settlement.blocker.missing-dispatch-authority",
    defaultMessage:
      "Only the settlement owner, the paying garden's stewards or the dispatcher can move disbursements.",
  },
  "source-paused": {
    id: "cockpit.garden.pool.settlement.blocker.source-paused",
    defaultMessage: "Settlement is paused on Arbitrum.",
  },
  "payer-account-inactive": {
    id: "cockpit.garden.pool.settlement.blocker.payer-account-inactive",
    defaultMessage: "The paying garden has no active settlement account.",
  },
  "beneficiary-account-inactive": {
    id: "cockpit.garden.pool.settlement.blocker.beneficiary-account-inactive",
    defaultMessage: "The receiving garden has no active settlement account.",
  },
  "gardener-delivery-disabled": {
    id: "cockpit.garden.pool.settlement.blocker.gardener-delivery-disabled",
    defaultMessage:
      "Gardener delivery is off. Contributor payouts cannot be prepared until the settlement owner enables it.",
  },
  "recognition-unready": {
    id: "cockpit.garden.pool.settlement.blocker.recognition-unready",
    defaultMessage: "The module did not accept the recognition vector for this roster.",
  },
  "chain-read-pending": {
    id: "cockpit.garden.pool.settlement.blocker.chain-read-pending",
    defaultMessage: "Reading the settlement module…",
  },
  "chain-read-failed": {
    id: "cockpit.garden.pool.settlement.blocker.chain-read-failed",
    defaultMessage: "The settlement module could not be read.",
  },
  acting: {
    id: "cockpit.garden.pool.settlement.blocker.acting",
    defaultMessage: "A transaction is already in flight.",
  },
};

export function blockerMessage(blocker: SettlementActionBlocker, intl: IntlShape): string {
  return intl.formatMessage(BLOCKER_MESSAGES[blocker]);
}

const ELIGIBILITY_MESSAGES: Record<SettlementEligibilityBlocker, Message> = {
  "pooling-unavailable": {
    id: "cockpit.garden.pool.settlement.ineligible.pooling-unavailable",
    defaultMessage: "Commitment pooling is not available on this chain.",
  },
  "not-fulfilled": {
    id: "cockpit.garden.pool.settlement.ineligible.not-fulfilled",
    defaultMessage: "The commitment is not fulfilled yet.",
  },
  "no-celo-consideration": {
    id: "cockpit.garden.pool.settlement.ineligible.no-celo-consideration",
    defaultMessage: "No Celo G$ consideration is declared on this commitment.",
  },
  "payer-garden-unknown": {
    id: "cockpit.garden.pool.settlement.ineligible.payer-garden-unknown",
    defaultMessage: "The paying garden is not set on this commitment.",
  },
};

export function eligibilityMessage(blocker: SettlementEligibilityBlocker, intl: IntlShape): string {
  return intl.formatMessage(ELIGIBILITY_MESSAGES[blocker]);
}

export function actionLabel(
  action: SettlementNextAction,
  intl: IntlShape,
  who: (address: string) => string
): string {
  switch (action.kind) {
    case "create-plan":
      return intl.formatMessage({
        id: "cockpit.garden.pool.settlement.act.create-plan",
        defaultMessage: "Create Payout Plan…",
      });
    case "finalize-plan":
      return intl.formatMessage({
        id: "cockpit.garden.pool.settlement.act.finalize-plan",
        defaultMessage: "Finalize Payout Plan…",
      });
    case "prepare-beneficiary":
      return intl.formatMessage({
        id: "cockpit.garden.pool.settlement.act.prepare-beneficiary",
        defaultMessage: "Prepare Garden Payout…",
      });
    case "prepare-contributor":
      return intl.formatMessage(
        {
          id: "cockpit.garden.pool.settlement.act.prepare-contributor",
          defaultMessage: "Prepare Payout for {who}…",
        },
        { who: who(action.contributor) }
      );
    case "dispatch":
      return intl.formatMessage({
        id: "cockpit.garden.pool.settlement.act.dispatch",
        defaultMessage: "Dispatch…",
      });
  }
}

/** The step a review dialog describes, in the imperative the sequence uses. */
export function actionStep(action: SettlementNextAction, intl: IntlShape): string {
  switch (action.kind) {
    case "create-plan":
      return stepLabel("create-plan", intl);
    case "finalize-plan":
      return stepLabel("finalize-plan", intl);
    case "prepare-beneficiary":
    case "prepare-contributor":
      return stepLabel("prepare-payout", intl);
    case "dispatch":
      return stepLabel("dispatch", intl);
  }
}
