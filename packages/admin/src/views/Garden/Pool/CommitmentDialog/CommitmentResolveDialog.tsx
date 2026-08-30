import type {
  CommitmentDialogController,
  DisputeResolutionKey,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import type { CommitmentDialogTone, OpenDialog } from "./commitmentDialogPresentation";

/**
 * Ending a review, and on what terms. Kept is offered only to a steward who
 * may hold it — nobody confirms their own work, and a record that had expired
 * cannot be kept — so the outcomes on offer follow the reader's standing.
 */
export function CommitmentResolveDialog({
  open,
  onClose,
  tone,
  can,
  acts,
  resolution,
  onResolutionChange,
  blockedReason,
}: {
  open: OpenDialog;
  onClose: () => void;
  tone: CommitmentDialogTone;
  can: CommitmentDialogController["can"];
  acts: CommitmentDialogController["acts"];
  resolution: DisputeResolutionKey;
  onResolutionChange: (resolution: DisputeResolutionKey) => void;
  blockedReason: string | undefined;
}) {
  const { formatMessage } = useIntl();

  return (
    <AdminReasonDialog
      isOpen={open === "resolve-dispute"}
      onClose={onClose}
      tone={tone}
      title={formatMessage({
        id: "cockpit.garden.pool.commitment.resolve.title",
        defaultMessage: "Resolve the Dispute",
      })}
      description={
        can.resolveFulfilled
          ? formatMessage({
              id: "cockpit.garden.pool.commitment.resolve.description",
              defaultMessage: "Every outcome records its reason in the member’s timeline.",
            })
          : formatMessage({
              id: "cockpit.garden.pool.commitment.resolve.descriptionNoFulfilled",
              defaultMessage:
                "You can’t mark this kept: nobody confirms their own work, and a record that had expired can’t be kept. A steward who isn’t on it may. Every outcome records its reason.",
            })
      }
      confirmLabel={formatMessage({
        id: "cockpit.garden.pool.commitment.resolve.confirm",
        defaultMessage: "Resolve",
      })}
      suggestions={[
        formatMessage({
          id: "cockpit.garden.pool.commitment.resolve.suggestion.gathering",
          defaultMessage: "Resolved at the gathering",
        }),
        formatMessage({
          id: "cockpit.garden.pool.commitment.resolve.suggestion.completed",
          defaultMessage: "Work completed since",
        }),
        formatMessage({
          id: "cockpit.garden.pool.commitment.resolve.suggestion.release",
          defaultMessage: "Agreed to release it",
        }),
      ]}
      blockedReason={blockedReason}
      onConfirm={async (reason) => {
        await acts.resolveDispute(resolution, reason);
        onClose();
      }}
    >
      <AdminChoiceGroup
        ariaLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.resolve.outcome",
          defaultMessage: "Outcome",
        })}
        value={resolution}
        onChange={(value) => onResolutionChange(value as DisputeResolutionKey)}
        options={[
          {
            value: "RESTORE_PREVIOUS",
            label: formatMessage({
              id: "cockpit.garden.pool.commitment.resolve.restore",
              defaultMessage: "Restore previous state",
            }),
            description: formatMessage({
              id: "cockpit.garden.pool.commitment.resolve.restoreHint",
              defaultMessage: "Returns the exact stored state, no unit movement",
            }),
          },
          ...(can.resolveFulfilled
            ? [
                {
                  value: "FULFILLED",
                  label: formatMessage({
                    id: "cockpit.garden.pool.commitment.resolve.fulfilled",
                    defaultMessage: "Kept",
                  }),
                  description: formatMessage({
                    id: "cockpit.garden.pool.commitment.resolve.fulfilledHint",
                    defaultMessage: "Counts as confirmed; the team is frozen",
                  }),
                },
              ]
            : []),
          {
            value: "CANCELLED",
            label: formatMessage({
              id: "cockpit.garden.pool.commitment.resolve.cancelled",
              defaultMessage: "Cancelled",
            }),
          },
          {
            value: "EXPIRED",
            label: formatMessage({
              id: "cockpit.garden.pool.commitment.resolve.expired",
              defaultMessage: "Expired",
            }),
          },
        ]}
      />
    </AdminReasonDialog>
  );
}
