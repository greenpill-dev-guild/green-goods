import { Alert } from "@green-goods/shared/components/Alert";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type {
  CommitmentDialogController,
  CommitmentSettlementController,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useCommitmentSettlementController } from "@green-goods/shared/hooks/admin-ui/pool/useCommitmentSettlementController";
import type { SettlementNextAction } from "@green-goods/shared/modules/commitment-pooling/settlement-workflow";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { RiRefreshLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { formatGdollar, shortAddress } from "../poolFundingPresentation";
import { CommitmentSettlementDisbursements } from "./CommitmentSettlementDisbursements";
import { CommitmentSettlementFacts } from "./CommitmentSettlementFacts";
import {
  actionLabel,
  actionStep,
  blockerMessage,
  eligibilityMessage,
  stepChip,
  stepLabel,
} from "./commitmentSettlementPresentation";

type Tone = "garden" | "hub" | "community";

export interface CommitmentSettlementProps {
  settlement: CommitmentSettlementController;
  tone: Tone;
}

/** Whether the inspector shows the payout section for this record at all. */
export function showsSettlement(
  commitment: Pick<CommitmentReadModel, "onchainState" | "considerationRail" | "payoutPlanId">
): boolean {
  return (
    (commitment.onchainState === "FULFILLED" &&
      commitment.considerationRail === "CELO_SETTLEMENT") ||
    Boolean(commitment.payoutPlanId)
  );
}

/** The inspector's mount point: reads through the shared controller, renders the section. */
export function CommitmentSettlementSection({
  chainId,
  commitment,
  detail,
  tone,
}: {
  chainId: number;
  commitment: CommitmentReadModel;
  detail: CommitmentDialogController["detail"];
  tone: Tone;
}) {
  const settlement = useCommitmentSettlementController({ chainId, commitment, detail });
  return <CommitmentSettlement settlement={settlement} tone={tone} />;
}

/**
 * The G$ payout for one fulfilled, priced commitment (settlement-spec §3.1.3):
 * who pays whom how much, whether the destination and route are ready, the
 * module's own sequence with its current step, and the one act the module
 * accepts next behind an explicit review. Every fact and every step comes from
 * the chain read the controller performs before and after each transaction.
 */
export function CommitmentSettlement({ settlement, tone }: CommitmentSettlementProps) {
  const intl = useIntl();
  const { formatMessage, locale } = intl;
  const [review, setReview] = useState<SettlementNextAction | null>(null);
  const { workflow, eligibility } = settlement;
  const who = (address: string) => shortAddress(address as `0x${string}`);

  const runAction = async (action: SettlementNextAction) => {
    const hash = await (action.kind === "create-plan"
      ? settlement.acts.createPlan()
      : action.kind === "finalize-plan"
        ? settlement.acts.finalizePlan()
        : action.kind === "prepare-beneficiary"
          ? settlement.acts.prepareBeneficiary()
          : action.kind === "prepare-contributor"
            ? settlement.acts.prepareContributor(action.contributor)
            : settlement.acts.dispatch(action.disbursementId));
    toastService.success({
      title: formatMessage({
        id: "cockpit.garden.pool.settlement.toast.confirmed",
        defaultMessage: "Settlement step confirmed",
      }),
      message: `${actionStep(action, intl)} · ${hash.slice(0, 10)}…`,
    });
  };

  const reviewRecipient = (action: SettlementNextAction) => {
    if (action.kind === "prepare-contributor") return who(action.contributor);
    if (settlement.kind === "GARDEN_BENEFICIARY" && settlement.beneficiaryAccount) {
      return who(settlement.beneficiaryAccount.account);
    }
    return formatMessage(
      {
        id: "cockpit.garden.pool.settlement.fact.recipientMembers",
        defaultMessage: "{count, plural, one {# contributor} other {# contributors}}",
      },
      { count: settlement.rows.length }
    );
  };

  const nextAction = workflow.nextAction;
  const currentStep = workflow.steps.find((step) => step.status === "current");

  return (
    <section
      className="space-y-3 border-t border-[rgb(var(--m3-outline-variant))] pt-4"
      aria-labelledby="commitment-settlement-title"
      data-component="CommitmentSettlement"
      data-state={workflow.complete ? "complete" : (workflow.currentStep ?? "idle")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 id="commitment-settlement-title" className="label-md text-text-strong">
            {formatMessage({
              id: "cockpit.garden.pool.settlement.title",
              defaultMessage: "G$ payout",
            })}
          </h4>
          <p className="mt-1 text-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.settlement.description",
              defaultMessage:
                "Paid from the paying garden's Celo Safe in the order the settlement module accepts: plan, finalize, prepare, dispatch, acknowledgement.",
            })}
          </p>
        </div>
        {workflow.complete ? (
          <StatusBadge variant="success" size="sm">
            {formatMessage({
              id: "cockpit.garden.pool.settlement.complete",
              defaultMessage: "Payout complete",
            })}
          </StatusBadge>
        ) : null}
      </div>

      {!eligibility.eligible ? (
        <Alert variant="info">
          {eligibility.blockers.map((blocker) => eligibilityMessage(blocker, intl)).join(" ")}
        </Alert>
      ) : (
        <>
          <CommitmentSettlementFacts settlement={settlement} />

          {settlement.chainRead === "failed" ? (
            <Alert
              variant="error"
              action={
                <AdminButton
                  type="button"
                  variant="text"
                  size="sm"
                  leadingIcon={<RiRefreshLine className="h-4 w-4" />}
                  onClick={() => void settlement.refetch()}
                >
                  {formatMessage({
                    id: "cockpit.garden.pool.settlement.retry",
                    defaultMessage: "Read Again",
                  })}
                </AdminButton>
              }
            >
              {formatMessage({
                id: "cockpit.garden.pool.settlement.readError",
                defaultMessage: "Couldn't read the settlement module",
              })}
            </Alert>
          ) : null}

          <ol
            className="space-y-1"
            aria-label={formatMessage({
              id: "cockpit.garden.pool.settlement.steps",
              defaultMessage: "Sequence",
            })}
            data-testid="settlement-steps"
          >
            {workflow.steps.map((step) => {
              const chip = stepChip(step, intl);
              return (
                <li
                  key={step.id}
                  className="flex items-center justify-between gap-3 text-body-md"
                  data-step={step.id}
                  data-status={step.status}
                >
                  <span
                    className={step.status === "upcoming" ? "text-text-soft" : "text-text-strong"}
                  >
                    {stepLabel(step.id, intl)}
                  </span>
                  <StatusBadge variant={chip.variant} size="sm">
                    {chip.label}
                  </StatusBadge>
                </li>
              );
            })}
          </ol>

          {currentStep && workflow.blockers.length > 0 ? (
            <Alert
              variant="warning"
              title={formatMessage({
                id: "cockpit.garden.pool.settlement.blocked.title",
                defaultMessage: "Why this cannot run yet",
              })}
            >
              <ul className="list-disc space-y-1 pl-4" data-testid="settlement-blockers">
                {workflow.blockers.map((blocker) => (
                  <li key={blocker}>{blockerMessage(blocker, intl)}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {settlement.lastAct ? (
            <p
              className={
                settlement.lastAct.phase === "failed"
                  ? "text-xs text-error-dark"
                  : "text-xs text-text-soft"
              }
              role="status"
              data-testid="settlement-act-status"
              data-phase={settlement.lastAct.phase}
            >
              {settlement.lastAct.phase === "signing"
                ? formatMessage({
                    id: "cockpit.garden.pool.settlement.status.signing",
                    defaultMessage: "Waiting for the wallet to sign and the chain to confirm…",
                  })
                : settlement.lastAct.phase === "confirmed"
                  ? formatMessage({
                      id: "cockpit.garden.pool.settlement.status.confirmed",
                      defaultMessage: "Confirmed on chain. Settlement state was read back.",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.settlement.status.failed",
                      defaultMessage:
                        "The transaction failed or was rejected. Nothing changed on chain.",
                    })}
            </p>
          ) : null}

          {nextAction ? (
            <div className="flex justify-end">
              <AdminButton
                type="button"
                variant="filled"
                size="sm"
                onClick={() => setReview(nextAction)}
                disabled={settlement.isActing}
                loading={settlement.isActing}
              >
                {actionLabel(nextAction, intl, who)}
              </AdminButton>
            </div>
          ) : null}

          <CommitmentSettlementDisbursements settlement={settlement} tone={tone} />
        </>
      )}

      <AdminConfirmDialog
        isOpen={review !== null}
        onClose={() => setReview(null)}
        tone={tone}
        variant="warning"
        title={formatMessage({
          id: "cockpit.garden.pool.settlement.review.title",
          defaultMessage: "Review before sending",
        })}
        description={
          review
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.settlement.review.body",
                  defaultMessage:
                    "{step} for {amount} from {payer} to {recipient}. One transaction; the chain is read back after it confirms.",
                },
                {
                  step: actionStep(review, intl),
                  amount: formatGdollar(settlement.declaredAmount, locale),
                  payer: settlement.payerAccount ? who(settlement.payerAccount.account) : "—",
                  recipient: reviewRecipient(review),
                }
              )
            : undefined
        }
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.settlement.review.confirm",
          defaultMessage: "Send Transaction",
        })}
        cancelLabel={formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        isLoading={settlement.isActing}
        onConfirm={async () => {
          if (!review) return;
          await runAction(review);
          setReview(null);
        }}
        onError={() => setReview(null)}
      />
    </section>
  );
}
