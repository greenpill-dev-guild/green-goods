import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
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
}) {
  const { formatMessage } = useIntl();

  return (
    <>
      {!isOnline ? (
        <p className="text-xs text-warning-dark" role="status">
          {offlineNote}
        </p>
      ) : null}

      <div
        className="flex flex-wrap justify-end gap-2 border-t border-[rgb(var(--m3-outline-variant))] pt-3"
        data-testid="commitment-acts"
      >
        {can.expire ? (
          <AdminButton
            type="button"
            variant="danger"
            size="sm"
            onClick={() => onOpenDialog("expire")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.row.act.expire",
              defaultMessage: "Expire now…",
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
            onClick={() => void acts.confirmOrdinary()}
            disabled={isActing}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.confirm",
              defaultMessage: "Confirm, commitment kept",
            })}
          </AdminButton>
        ) : null}
        {can.sendForConfirmation ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => void acts.sendForConfirmation()}
            disabled={isActing}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.send",
              defaultMessage: "Send for Confirmation",
            })}
          </AdminButton>
        ) : null}
      </div>
    </>
  );
}
