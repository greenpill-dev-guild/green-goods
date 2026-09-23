import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import { AdminButton } from "@/components/AdminButton";
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
        <p className="text-xs text-warning-dark" role="status">
          {offlineNote}
        </p>
      ) : null}

      <div
        className="flex flex-wrap justify-end gap-2 border-t border-stroke-soft pt-3"
        data-testid="commitment-acts"
      >
        {onSeedAnother ? (
          <AdminButton
            type="button"
            variant="text"
            size="sm"
            disabled={actDisabled}
            onClick={onSeedAnother}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.seedAnother",
              defaultMessage: "Seed Another Like This",
            })}
          </AdminButton>
        ) : null}
        {can.raiseDispute ? (
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => onOpenDialog("raise-dispute")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.raiseDispute",
              defaultMessage: "Raise dispute…",
            })}
          </AdminButton>
        ) : null}
        {can.resolveDispute ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => onOpenDialog("resolve-dispute")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.resolve",
              defaultMessage: "Resolve…",
            })}
          </AdminButton>
        ) : null}
        {can.confirmFallback ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => onOpenDialog("fallback-confirm")}
            disabled={actDisabled}
          >
            {fallbackPath === "PROTOCOL_FALLBACK"
              ? formatMessage({
                  id: "cockpit.garden.pool.commitment.act.confirmProtocol",
                  defaultMessage: "Confirm for Green Goods team…",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.commitment.act.confirmGarden",
                  defaultMessage: "Confirm as garden fallback…",
                })}
          </AdminButton>
        ) : null}
        {can.confirmOrdinary ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => onOpenDialog("confirm-kept")}
            disabled={isActing}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.confirm",
              defaultMessage: "Confirm Kept…",
            })}
          </AdminButton>
        ) : null}
        {can.sendForConfirmation ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => void acts.sendForConfirmation().catch(() => undefined)}
            disabled={isActing || sendHeld}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.send",
              defaultMessage: "Send for Confirmation",
            })}
          </AdminButton>
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
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => onOpenDialog("expire")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.row.act.expire",
              defaultMessage: "Expire now…",
            })}
          </AdminButton>
        </div>
      ) : null}
    </>
  );
}
