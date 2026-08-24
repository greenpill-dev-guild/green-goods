import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import type { OpenDialog } from "./commitmentDialogPresentation";

/**
 * The acts a steward has while the record is Accepted and the ordinary path
 * has stalled: mark it ready, attach the assessment it waits on, or call it
 * off — each one reasoned, none of them silent.
 */
export function CommitmentRecovery({
  evidenceOnly,
  can,
  actDisabled,
  onOpenDialog,
}: {
  /**
   * No work requirements and no impact gate: proof alone carries the record.
   * Chooses the override's wording; a work-backed record gets the same act.
   */
  evidenceOnly: boolean;
  can: CommitmentDialogController["can"];
  actDisabled: boolean;
  onOpenDialog: (open: OpenDialog) => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="space-y-2"
      data-testid="commitment-accepted-acts"
      aria-label={formatMessage({
        id: "cockpit.garden.pool.commitment.accepted.label",
        defaultMessage: "Recovery",
      })}
    >
      {/*
        The override is the only recovery a stalled record has, and a
        work-backed one stalls the more often of the two: the chain lets a
        steward waive the outstanding requirements (ConfirmLib.markReadyForConfirmation
        never reads them) while credit, cycle, freshness and confirmer gates all
        still hold. `evidenceOnly` picks which story to tell, never whether to
        offer the act.
      */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2">
        <p className="min-w-0 text-sm">
          <span className="font-medium text-text-strong">
            {evidenceOnly
              ? formatMessage({
                  id: "cockpit.garden.pool.commitment.accepted.cannotConfirm",
                  defaultMessage: "Recipient can’t confirm?",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.commitment.accepted.workStalled",
                  defaultMessage: "Work still outstanding?",
                })}
          </span>{" "}
          <span className="text-text-soft">
            {evidenceOnly
              ? formatMessage({
                  id: "cockpit.garden.pool.commitment.accepted.cannotConfirmHint",
                  defaultMessage: "A steward can mark it ready with a recorded reason.",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.commitment.accepted.workStalledHint",
                  defaultMessage:
                    "A steward can mark it ready with a recorded reason. The credit already verified still counts.",
                })}
          </span>
        </p>
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          onClick={() => onOpenDialog("mark-ready")}
          disabled={actDisabled || !can.markReady}
        >
          {formatMessage({
            id: "cockpit.garden.pool.commitment.act.markReady",
            defaultMessage: "Mark ready…",
          })}
        </AdminButton>
      </div>
      {can.attachAssessment ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2">
          <p className="min-w-0 text-sm">
            <span className="font-medium text-text-strong">
              {formatMessage({
                id: "cockpit.garden.pool.commitment.accepted.assessment",
                defaultMessage: "Assessment required",
              })}
            </span>{" "}
            <span className="text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.commitment.accepted.assessmentHint",
                defaultMessage:
                  "Only assessments recorded for the provider garden can be attached.",
              })}
            </span>
          </p>
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => onOpenDialog("attach-assessment")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.attachAssessment",
              defaultMessage: "Attach assessment…",
            })}
          </AdminButton>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2">
        <p className="min-w-0 text-sm">
          <span className="font-medium text-text-strong">
            {formatMessage({
              id: "cockpit.garden.pool.commitment.accepted.calledOff",
              defaultMessage: "Called off?",
            })}
          </span>{" "}
          <span className="text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.commitment.accepted.calledOffHint",
              defaultMessage: "Cancelling releases the committed units and records why.",
            })}
          </span>
        </p>
        <AdminButton
          type="button"
          variant="danger"
          size="sm"
          onClick={() => onOpenDialog("cancel")}
          disabled={actDisabled || !can.cancel}
        >
          {formatMessage({
            id: "cockpit.garden.pool.commitment.act.cancel",
            defaultMessage: "Cancel commitment…",
          })}
        </AdminButton>
      </div>
    </section>
  );
}
