import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import type {
  CommitmentDialogTone,
  FallbackPath,
  OpenDialog,
} from "./commitmentDialogPresentation";

interface ReasonDialogProps {
  /** Which dialog the panel has on screen; each one reads its own key. */
  open: OpenDialog;
  onClose: () => void;
  tone: CommitmentDialogTone;
  acts: CommitmentDialogController["acts"];
  /** Why confirming is out of reach, or undefined when it is within reach. */
  blockedReason: string | undefined;
}

/**
 * The three reasoned acts on a live record — call it off, mark it ready over
 * the recipient's send, or freeze it for review. Each one records why, and the
 * member sees that reason rather than the bare state.
 */
export function CommitmentReasonDialogs({
  open,
  onClose,
  tone,
  acts,
  blockedReason,
}: ReasonDialogProps) {
  const { formatMessage } = useIntl();

  return (
    <>
      <AdminReasonDialog
        isOpen={open === "cancel"}
        onClose={onClose}
        tone={tone}
        variant="danger"
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.cancel.title",
          defaultMessage: "Cancel this commitment",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.commitment.cancel.description",
          defaultMessage:
            "Accepted becomes Cancelled with a recorded reason. Committed units release; the member sees the reason, never “cancelled” alone.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.cancel.confirm",
          defaultMessage: "Cancel commitment",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.cancel.keep",
          defaultMessage: "Keep commitment",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.commitment.cancel.suggestion.agreement",
            defaultMessage: "Withdrawn by agreement",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.cancel.suggestion.notNeeded",
            defaultMessage: "No longer needed",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.cancel.suggestion.duplicate",
            defaultMessage: "Duplicate commitment",
          }),
        ]}
        blockedReason={blockedReason}
        onConfirm={async (reason) => {
          await acts.cancel(reason);
          onClose();
        }}
      />
      <AdminReasonDialog
        isOpen={open === "mark-ready"}
        onClose={onClose}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.markReady.title",
          defaultMessage: "Mark ready with override",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.commitment.markReady.description",
          defaultMessage:
            "A steward override, separate from sending for confirmation. Moves the commitment to Ready without the recipient’s send; the reason is stored and shows in the member timeline.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.markReady.confirm",
          defaultMessage: "Mark ready",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.commitment.markReady.suggestion.field",
            defaultMessage: "Checked in the field",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.markReady.suggestion.device",
            defaultMessage: "Recipient has no device",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.markReady.suggestion.gathering",
            defaultMessage: "Agreed at the gathering",
          }),
        ]}
        blockedReason={blockedReason}
        onConfirm={async (reason) => {
          await acts.markReady(reason);
          onClose();
        }}
      />
      <AdminReasonDialog
        isOpen={open === "raise-dispute"}
        onClose={onClose}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.dispute.title",
          defaultMessage: "Raise a dispute",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.commitment.dispute.description",
          defaultMessage:
            "Freezes the commitment for review. Members see “under review by stewards”, never dispute language.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.dispute.confirm",
          defaultMessage: "Raise dispute",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.contested",
            defaultMessage: "Delivery contested",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.details",
            defaultMessage: "Details look wrong",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.secondLook",
            defaultMessage: "Needs a second look",
          }),
        ]}
        blockedReason={blockedReason}
        onConfirm={async (reason) => {
          await acts.raiseDispute(reason);
          onClose();
        }}
      />
    </>
  );
}

/**
 * Confirming when nobody on the ordinary path can: on this garden's steward
 * authority, or the Green Goods team's when the commitment allows it. Every
 * contributor is excluded, and the reason lands in the member's timeline.
 */
export function CommitmentFallbackDialog({
  open,
  onClose,
  tone,
  acts,
  blockedReason,
  fallbackPath,
}: ReasonDialogProps & { fallbackPath: FallbackPath }) {
  const { formatMessage } = useIntl();

  return (
    <AdminReasonDialog
      isOpen={open === "fallback-confirm"}
      onClose={onClose}
      tone={tone}
      title={
        fallbackPath === "PROTOCOL_FALLBACK"
          ? formatMessage({
              id: "cockpit.garden.pool.commitment.fallback.protocolTitle",
              defaultMessage: "Confirm for the Green Goods team",
            })
          : formatMessage({
              id: "cockpit.garden.pool.commitment.fallback.gardenTitle",
              defaultMessage: "Confirm as garden fallback",
            })
      }
      description={
        fallbackPath === "PROTOCOL_FALLBACK"
          ? formatMessage({
              id: "cockpit.garden.pool.commitment.fallback.protocolDescription",
              defaultMessage:
                "Uses the Green Goods protocol garden’s authority, checked at signing. Every contributor is blocked, and module ownership alone grants nothing. The member timeline will say “confirmed by Green Goods team, fallback” with this reason.",
            })
          : formatMessage({
              id: "cockpit.garden.pool.commitment.fallback.gardenDescription",
              defaultMessage:
                "Uses this garden’s steward authority. Every frozen team address is blocked. The member timeline will say “confirmed by garden steward, fallback” with this reason.",
            })
      }
      confirmLabel={
        fallbackPath === "PROTOCOL_FALLBACK"
          ? formatMessage({
              id: "cockpit.garden.pool.commitment.act.confirmProtocolConfirm",
              defaultMessage: "Confirm for Green Goods team",
            })
          : formatMessage({
              id: "cockpit.garden.pool.commitment.act.confirmGardenConfirm",
              defaultMessage: "Confirm as garden fallback",
            })
      }
      suggestions={
        fallbackPath === "PROTOCOL_FALLBACK"
          ? [
              formatMessage({
                id: "cockpit.garden.pool.commitment.fallback.suggestion.noLocal",
                defaultMessage: "No eligible local confirmer",
              }),
              formatMessage({
                id: "cockpit.garden.pool.commitment.fallback.suggestion.unreachable",
                defaultMessage: "Named group unreachable",
              }),
              formatMessage({
                id: "cockpit.garden.pool.commitment.fallback.suggestion.leftGarden",
                defaultMessage: "Recipient left the garden",
              }),
            ]
          : [
              formatMessage({
                id: "cockpit.garden.pool.commitment.fallback.suggestion.siteVisit",
                defaultMessage: "Confirmed on a site visit",
              }),
              formatMessage({
                id: "cockpit.garden.pool.commitment.markReady.suggestion.device",
                defaultMessage: "Recipient has no device",
              }),
              formatMessage({
                id: "cockpit.garden.pool.commitment.markReady.suggestion.gathering",
                defaultMessage: "Agreed at the gathering",
              }),
            ]
      }
      blockedReason={blockedReason}
      onConfirm={async (reason) => {
        await acts.confirmFallback(reason);
        onClose();
      }}
    />
  );
}

/** Declining one request to take the commitment up, with the reason the asker sees. */
export function CommitmentDeclineClaimDialog({
  open,
  onClose,
  tone,
  acts,
  blockedReason,
}: ReasonDialogProps) {
  const { formatMessage } = useIntl();

  return (
    <AdminReasonDialog
      isOpen={typeof open === "object" && open?.kind === "decline-claim"}
      onClose={onClose}
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
      blockedReason={blockedReason}
      onConfirm={async (reason) => {
        if (typeof open !== "object" || open?.kind !== "decline-claim") return;
        await acts.declineClaim(open.claimant, reason);
        onClose();
      }}
    />
  );
}
