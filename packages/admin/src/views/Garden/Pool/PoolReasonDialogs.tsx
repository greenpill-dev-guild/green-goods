import type { PoolConsoleController } from "@green-goods/shared";
import type { Dispatch, SetStateAction } from "react";
import { useIntl } from "react-intl";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import type { ReasonDialog } from "./poolDialogState";
import { cycleName } from "./poolPresentation";

/**
 * The pool console's three reasoned acts — pause, cancel a cycle, decline a
 * claim. Each pins its reason before the call. Split out of `PoolDialogs`,
 * which is at its source-structure cap.
 */
export function PoolReasonDialogs({
  pool,
  tone,
  reasonDialog,
  setReasonDialog,
}: {
  pool: PoolConsoleController;
  tone: "garden" | "hub" | "community";
  reasonDialog: ReasonDialog;
  setReasonDialog: Dispatch<SetStateAction<ReasonDialog>>;
}) {
  const { formatMessage } = useIntl();
  return (
    <>
      <AdminReasonDialog
        isOpen={reasonDialog?.kind === "pause"}
        onClose={() => setReasonDialog(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.pause.title",
          defaultMessage: "Pause this pool",
        })}
        description={formatMessage(
          {
            id: "cockpit.garden.pool.pause.description",
            defaultMessage:
              "Pausing stops new commitments, claims, and confirmations across {count, plural, one {# open commitment} other {# open commitments}}. Proof, work linkage, and recovery stay open; resuming clears this reason.",
          },
          { count: pool.model.groups.open.length }
        )}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.pause.confirm",
          defaultMessage: "Pause pool",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.pause.keep",
          defaultMessage: "Keep running",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.pause.suggestion.weather",
            defaultMessage: "Weather or season",
          }),
          formatMessage({
            id: "cockpit.garden.pool.pause.suggestion.regroup",
            defaultMessage: "Group is regrouping",
          }),
          formatMessage({
            id: "cockpit.garden.pool.pause.suggestion.safety",
            defaultMessage: "Safety first",
          }),
        ]}
        blockedReason={
          pool.isOnline
            ? undefined
            : formatMessage({
                id: "cockpit.garden.pool.offline",
                defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
              })
        }
        onConfirm={async (reason) => {
          await pool.acts.pause(reason);
          setReasonDialog(null);
        }}
      />

      <AdminReasonDialog
        isOpen={reasonDialog?.kind === "cancel-cycle"}
        onClose={() => setReasonDialog(null)}
        tone={tone}
        variant="danger"
        title={
          reasonDialog?.kind === "cancel-cycle" && reasonDialog.cycle.cycleType === "CAMPAIGN"
            ? formatMessage({
                id: "cockpit.garden.pool.cancelCycle.campaignTitle",
                defaultMessage: "Cancel this campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.cancelCycle.seasonTitle",
                defaultMessage: "Cancel this season",
              })
        }
        description={formatMessage(
          {
            id: "cockpit.garden.pool.cancelCycle.description",
            defaultMessage:
              "“{name}” has no live commitments. Cancelling ends it for everyone in it; each commitment keeps its own record, and members see the reason you give here.",
          },
          {
            name:
              reasonDialog?.kind === "cancel-cycle"
                ? cycleName(reasonDialog.cycle, pool.cycleNames, formatMessage)
                : "",
          }
        )}
        confirmLabel={
          reasonDialog?.kind === "cancel-cycle" && reasonDialog.cycle.cycleType === "CAMPAIGN"
            ? formatMessage({
                id: "cockpit.garden.pool.cancelCycle.confirmCampaign",
                defaultMessage: "Cancel campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.cancelCycle.confirmSeason",
                defaultMessage: "Cancel season",
              })
        }
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.cancelCycle.keep",
          defaultMessage: "Keep it",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.cancelCycle.suggestion.funding",
            defaultMessage: "Funding fell through",
          }),
          formatMessage({
            id: "cockpit.garden.pool.cancelCycle.suggestion.replanned",
            defaultMessage: "Replanned",
          }),
          formatMessage({
            id: "cockpit.garden.pool.cancelCycle.suggestion.mistake",
            defaultMessage: "Started by mistake",
          }),
        ]}
        blockedReason={
          pool.isOnline
            ? undefined
            : formatMessage({
                id: "cockpit.garden.pool.offline",
                defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
              })
        }
        onConfirm={async (reason) => {
          if (reasonDialog?.kind !== "cancel-cycle") return;
          await pool.acts.cancelCycle(reasonDialog.cycle.cycleId, reason);
          setReasonDialog(null);
        }}
      />

      <AdminReasonDialog
        isOpen={reasonDialog?.kind === "decline-claim"}
        onClose={() => setReasonDialog(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.declineClaim.title",
          defaultMessage: "Decline this request",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.declineClaim.description",
          defaultMessage:
            "Only this request is declined; others stay pending and the commitment stays claimable. The person sees your reason and may ask again.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.declineClaim.confirm",
          defaultMessage: "Decline request",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.declineClaim.keep",
          defaultMessage: "Keep pending",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.declineClaim.suggestion.full",
            defaultMessage: "Crew is full",
          }),
          formatMessage({
            id: "cockpit.garden.pool.declineClaim.suggestion.experience",
            defaultMessage: "Needs more experience",
          }),
          formatMessage({
            id: "cockpit.garden.pool.declineClaim.suggestion.chosen",
            defaultMessage: "Asked after another was chosen",
          }),
        ]}
        blockedReason={
          pool.isOnline
            ? undefined
            : formatMessage({
                id: "cockpit.garden.pool.offline",
                defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
              })
        }
        onConfirm={async (reason) => {
          if (reasonDialog?.kind !== "decline-claim") return;
          await pool.acts.declineClaim(
            reasonDialog.row.claim.commitmentId,
            reasonDialog.row.claim.claimant,
            reason
          );
          setReasonDialog(null);
        }}
      />
    </>
  );
}
