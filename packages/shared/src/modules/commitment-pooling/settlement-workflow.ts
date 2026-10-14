/**
 * Settlement workflow selectors
 *
 * The steward's payout plan read as the sequence the settlement module
 * accepts: create the plan, (the default contributor split), finalize,
 * prepare the child disbursement, dispatch it, wait for the Celo
 * acknowledgement. Every step says whether it is done, current or still
 * ahead and names the chain gate behind each blocker, so the admin never
 * offers a call the module would refuse and never recreates a plan the chain
 * already holds — `payoutPlanOfCommitment` is the parent pointer and it is
 * never cleared (settlement-spec §3.1.3).
 *
 * Pure: everything here derives from chain reads and the reader's authority.
 *
 * @module modules/commitment-pooling/settlement-workflow
 */

import { selectSettlementActions } from "./settlement";
import type {
  SettlementActionBlocker,
  SettlementChainDisbursement,
  SettlementDisbursementView,
  SettlementDisplayState,
  SettlementNextAction,
  SettlementStep,
  SettlementWorkflow,
  SettlementWorkflowInput,
} from "./settlement-workflow-types";

export type * from "./settlement-workflow-types";
export * from "./settlement-eligibility";

const DEFAULT_DELAY_AFTER_SECONDS = 30 * 60;

function unique(blockers: readonly SettlementActionBlocker[]): SettlementActionBlocker[] {
  return [...new Set(blockers)];
}

function connectionBlockers(input: SettlementWorkflowInput): SettlementActionBlocker[] {
  const blockers: SettlementActionBlocker[] = [];
  if (input.chainRead === "pending") blockers.push("chain-read-pending");
  if (input.chainRead === "failed") blockers.push("chain-read-failed");
  if (!input.authority.viewer) blockers.push("wallet-disconnected");
  if (!input.isOnline) blockers.push("offline");
  if (input.isActing) blockers.push("acting");
  return blockers;
}

function stewardBlockers(input: SettlementWorkflowInput): SettlementActionBlocker[] {
  return input.authority.isPayerSteward ? [] : ["missing-payer-steward"];
}

function accountBlockers(input: SettlementWorkflowInput): SettlementActionBlocker[] {
  const blockers: SettlementActionBlocker[] = [];
  if (input.payerAccountActive === false) blockers.push("payer-account-inactive");
  if (input.kind === "GARDEN_BENEFICIARY" && input.beneficiaryAccountActive === false) {
    blockers.push("beneficiary-account-inactive");
  }
  return blockers;
}

function pausedBlockers(input: SettlementWorkflowInput): SettlementActionBlocker[] {
  return input.sourcePaused === true ? ["source-paused"] : [];
}

function displayOf(
  disbursement: SettlementChainDisbursement,
  input: SettlementWorkflowInput
): SettlementDisplayState {
  switch (disbursement.state) {
    case "CONFIRMED":
      return "confirmed";
    case "CANCELLED":
      return "cancelled";
    case "FAILED":
      return "failed";
    case "QUEUED":
      return "queued";
    case "DISPATCHED": {
      if (disbursement.acknowledgmentPending) return "acknowledgement-pending";
      const now = input.now ?? Math.floor(Date.now() / 1000);
      const delayed =
        disbursement.dispatchedAt !== null &&
        now - disbursement.dispatchedAt > (input.delayAfterSeconds ?? DEFAULT_DELAY_AFTER_SECONDS);
      return delayed ? "delivery-delayed" : "dispatched";
    }
    default:
      return "unknown";
  }
}

function disbursementView(
  disbursement: SettlementChainDisbursement,
  input: SettlementWorkflowInput
): SettlementDisbursementView {
  const canAct =
    Boolean(input.authority.viewer) &&
    input.isOnline &&
    !input.isActing &&
    input.chainRead === "ready";
  const actions = selectSettlementActions({
    state: disbursement.state,
    isBatch: false,
    isBatchMember: disbursement.batchId !== null && disbursement.batchId !== 0n,
    kind: kindOf(disbursement.kind),
    sourcePaused: input.sourcePaused === true,
    canDispatchOrRetry: input.authority.canDispatchOrRetry && canAct,
    canRequeueOrCancel: input.authority.canRequeueOrCancel && canAct,
  });
  return {
    disbursement,
    display: displayOf(disbursement, input),
    retryable: disbursement.state === "FAILED",
    actions: {
      // LifecycleLib.dispatchDisbursement refuses a batched child; the batch
      // is dispatched as a whole through its own surface.
      dispatch: actions.dispatch && !(disbursement.batchId !== null && disbursement.batchId !== 0n),
      retry: actions.retrySameCommand,
      requeue: actions.startNewAttempt,
      cancel: actions.cancelIndividual,
    },
  };
}

function kindOf(
  kind: string
):
  | "CONTRIBUTOR_CONSIDERATION"
  | "FUNDING"
  | "LOAN_PRINCIPAL"
  | "GARDEN_BENEFICIARY"
  | "REFUND"
  | undefined {
  switch (kind) {
    case "CONTRIBUTOR_CONSIDERATION":
    case "FUNDING":
    case "LOAN_PRINCIPAL":
    case "GARDEN_BENEFICIARY":
    case "REFUND":
      return kind;
    default:
      return undefined;
  }
}

/**
 * The whole sequence for one commitment. Each gate mirrors PlanLib and
 * LifecycleLib: creation needs the payer's steward and an active payer (and,
 * for a beneficiary plan, an active beneficiary) account; finalization needs
 * the same steward and accounts; preparation adds the unpaused source and,
 * for contributor rows only, `gardenerDeliveryEnabled`; dispatch is the
 * settlement operator's act and stops while the source is paused.
 */
export function selectSettlementWorkflow(input: SettlementWorkflowInput): SettlementWorkflow {
  const base = connectionBlockers(input);
  const { plan, kind } = input;
  const steps: SettlementStep[] = [];

  const createBlockers = plan
    ? []
    : unique([
        ...base,
        ...stewardBlockers(input),
        ...accountBlockers(input),
        ...(kind === "CONTRIBUTOR_CONSIDERATION" && input.recognitionReady !== true
          ? (["recognition-unready"] as const)
          : []),
      ]);
  steps.push({ id: "create-plan", status: plan ? "done" : "current", blockers: createBlockers });

  if (kind === "CONTRIBUTOR_CONSIDERATION") {
    // The module writes the recognition-weighted default vector at creation,
    // so the split is settled the moment the plan exists.
    steps.push({ id: "contributor-split", status: plan ? "done" : "upcoming", blockers: [] });
  }

  const finalizeBlockers =
    plan && !plan.finalized
      ? unique([...base, ...stewardBlockers(input), ...accountBlockers(input)])
      : [];
  steps.push({
    id: "finalize-plan",
    status: !plan ? "upcoming" : plan.finalized ? "done" : "current",
    blockers: finalizeBlockers,
  });

  // A finalized contributor plan with nothing payable completed locally at
  // finalization (settlement-spec §3.1.3); there is nothing to prepare.
  const nothingPayable =
    kind === "CONTRIBUTOR_CONSIDERATION" &&
    Boolean(plan?.finalized) &&
    plan?.payablePayoutCount === 0;
  const prepared =
    nothingPayable ||
    (kind === "GARDEN_BENEFICIARY"
      ? plan?.beneficiaryDisbursementId !== null &&
        plan?.beneficiaryDisbursementId !== undefined &&
        plan.beneficiaryDisbursementId !== 0n
      : Boolean(
          plan && plan.payablePayoutCount > 0 && plan.preparedPayoutCount >= plan.payablePayoutCount
        ));
  const unpreparedRow = input.rows.find(
    (row) => row.amount > 0n && (row.disbursementId === null || row.disbursementId === 0n)
  );
  const prepareBlockers =
    plan?.finalized && !prepared
      ? unique([
          ...base,
          ...stewardBlockers(input),
          ...pausedBlockers(input),
          ...accountBlockers(input),
          ...(kind === "CONTRIBUTOR_CONSIDERATION" && input.gardenerDeliveryEnabled !== true
            ? (["gardener-delivery-disabled"] as const)
            : []),
        ])
      : [];
  steps.push({
    id: "prepare-payout",
    status: !plan?.finalized ? "upcoming" : prepared ? "done" : "current",
    blockers: prepareBlockers,
  });

  const views = input.disbursements.map((disbursement) => disbursementView(disbursement, input));
  const states = views.map((view) => view.disbursement.state);
  const allConfirmed = states.length > 0 && states.every((state) => state === "CONFIRMED");
  const anyToDispatch = states.some((state) => state === "QUEUED" || state === "FAILED");
  const anyDispatched = states.some((state) => state === "DISPATCHED");
  const dispatchBlockers = anyToDispatch
    ? unique([
        ...base,
        ...(input.authority.canDispatchOrRetry ? [] : (["missing-operator"] as const)),
        ...pausedBlockers(input),
      ])
    : [];
  steps.push({
    id: "dispatch",
    status: nothingPayable
      ? "done"
      : !prepared
        ? "upcoming"
        : anyToDispatch
          ? "current"
          : states.length > 0
            ? "done"
            : "upcoming",
    blockers: dispatchBlockers,
  });
  steps.push({
    id: "acknowledgement",
    status: nothingPayable || allConfirmed ? "done" : anyDispatched ? "current" : "upcoming",
    blockers: [],
  });

  const currentStep = steps.find((step) => step.status === "current") ?? null;
  const blockers = currentStep?.blockers ?? [];
  const queued = views.find(
    (view) => view.disbursement.state === "QUEUED" && view.actions.dispatch
  );

  let nextAction: SettlementNextAction | null = null;
  if (currentStep && blockers.length === 0) {
    switch (currentStep.id) {
      case "create-plan":
        nextAction = { kind: "create-plan" };
        break;
      case "finalize-plan":
        if (plan) nextAction = { kind: "finalize-plan", payoutPlanId: plan.payoutPlanId };
        break;
      case "prepare-payout":
        if (plan && kind === "GARDEN_BENEFICIARY") {
          nextAction = { kind: "prepare-beneficiary", payoutPlanId: plan.payoutPlanId };
        } else if (plan && unpreparedRow) {
          nextAction = {
            kind: "prepare-contributor",
            payoutPlanId: plan.payoutPlanId,
            contributor: unpreparedRow.contributor,
          };
        }
        break;
      case "dispatch":
        if (queued)
          nextAction = { kind: "dispatch", disbursementId: queued.disbursement.disbursementId };
        break;
      default:
        break;
    }
  }

  return {
    steps,
    currentStep: currentStep?.id ?? null,
    nextAction,
    blockers,
    disbursements: views,
    complete: plan?.status === "COMPLETE" || nothingPayable,
  };
}
