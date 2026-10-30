import { Button } from "@green-goods/shared/components/Button";
import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import type { FallbackPath, OpenDialog } from "./commitmentDialogPresentation";

/**
 * The acts the reader's authority and the record's state allow, with the
 * offline note above them: every one of these goes straight to the chain.
 */
export function CommitmentActions({
  isOnline,
  offlineNote,
  can,
  acts,
  actDisabled,
  isActing,
  fallbackPath,
  onOpenDialog,
  onSeedAnother,
  onEditReward,
  sendPhase,
  chainId,
}: {
  isOnline: boolean;
  /** Why the acts are out of reach while the reader has no connection. */
  offlineNote: string;
  can: CommitmentDialogController["can"];
  acts: CommitmentDialogController["acts"];
  actDisabled: boolean;
  isActing: boolean;
  fallbackPath: FallbackPath;
  onOpenDialog: (open: OpenDialog) => void;
  /**
   * Opens the seeding wizard on this commitment's answers. Absent wherever the
   * reader may not seed this pool, so the button is simply not drawn.
   */
  onSeedAnother?: () => void;
  /** Change the reward while nobody has taken the promise (PRD-1022 D14); only a steward gets it. */
  onEditReward?: () => void;
  /** Where Send for Confirmation stands, followed from the wallet to the chain. */
  sendPhase: CommitmentDialogController["sendPhase"];
  chainId: number;
}) {
  const { formatMessage } = useIntl();
  // Sent, or kept queued to send: the act stays closed until the record moves on.
  const sendHeld = sendPhase.status !== "idle" && sendPhase.status !== "failed";

  return (
    <>
      {!isOnline ? (
        <p className="type-meta text-warning-dark" role="status">
          {offlineNote}
        </p>
      ) : null}

      <div
        className="flex flex-wrap justify-end gap-2 border-t border-stroke-soft pt-3"
        data-testid="commitment-acts"
      >
        {onEditReward ? (
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            disabled={actDisabled}
            onClick={onEditReward}
          >
            {formatMessage({
              id: "cockpit.garden.pool.reward.title",
              defaultMessage: "Edit Reward",
            })}
          </Button>
        ) : null}
        {onSeedAnother ? (
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            disabled={actDisabled}
            onClick={onSeedAnother}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.seedAnother",
              defaultMessage: "Seed Another Like This",
            })}
          </Button>
        ) : null}
        {can.raiseDispute ? (
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            onClick={() => onOpenDialog("raise-dispute")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.raiseDispute",
              defaultMessage: "Raise Dispute…",
            })}
          </Button>
        ) : null}
        {can.resolveDispute ? (
          <Button
            type="button"
            emphasis="primary"
            size="compact"
            onClick={() => onOpenDialog("resolve-dispute")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.resolve",
              defaultMessage: "Resolve…",
            })}
          </Button>
        ) : null}
        {can.confirmFallback ? (
          <Button
            type="button"
            emphasis="primary"
            size="compact"
            onClick={() => onOpenDialog("fallback-confirm")}
            disabled={actDisabled}
          >
            {fallbackPath === "PROTOCOL_FALLBACK"
              ? formatMessage({
                  id: "cockpit.garden.pool.commitment.act.confirmProtocol",
                  defaultMessage: "Confirm for Green Goods Team…",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.commitment.act.confirmGarden",
                  defaultMessage: "Confirm as Garden Fallback…",
                })}
          </Button>
        ) : null}
        {can.confirmOrdinary ? (
          <Button
            type="button"
            emphasis="primary"
            size="compact"
            onClick={() => onOpenDialog("confirm-kept")}
            disabled={isActing}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.confirm",
              defaultMessage: "Confirm Kept…",
            })}
          </Button>
        ) : null}
        {can.sendForConfirmation ? (
          <Button
            type="button"
            emphasis="primary"
            size="compact"
            onClick={() => void acts.sendForConfirmation().catch(() => undefined)}
            disabled={isActing || sendHeld}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.send",
              defaultMessage: "Send for Confirmation",
            })}
          </Button>
        ) : null}
      </div>
      {can.sendForConfirmation || sendPhase.status !== "idle" ? (
        <ActPhaseLine
          phase={sendPhase}
          chainId={chainId}
          confirmed={formatMessage({
            id: "cockpit.garden.pool.commitment.act.sent",
            defaultMessage: "Sent for confirmation. Its confirmers see it once the index shows it.",
          })}
        />
      ) : null}

      {can.expire ? (
        // Final and destructive, so it never shares the routine cluster: its own
        // row after the routine ones, quiet where it sits, loud only inside its
        // confirmation.
        <div className="flex justify-end border-t border-stroke-soft pt-3" data-slot="expire">
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            onClick={() => onOpenDialog("expire")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.row.act.expire",
              defaultMessage: "Expire Now…",
            })}
          </Button>
        </div>
      ) : null}
    </>
  );
}
