import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { useIntl } from "react-intl";

interface LeaveGardenConfirmDialogProps {
  open: boolean;
  gardenName: string;
  isOwner: boolean;
  checking: boolean;
  checkFailed: boolean;
  recovery?: boolean;
  availability: "available" | "unavailable" | "unknown" | "checking";
  isLeaving: boolean;
  failure: string | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onRetry: () => void;
}

/** The garden and every departure consequence stay visible before signing. */
export function LeaveGardenConfirmDialog({
  open,
  gardenName,
  isOwner,
  checking,
  checkFailed,
  availability,
  recovery = false,
  isLeaving,
  failure,
  onClose,
  onConfirm,
  onRetry,
}: LeaveGardenConfirmDialogProps) {
  const { formatMessage: message } = useIntl();
  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next && !isLeaving) onClose();
      }}
      title={message(
        { id: recovery ? "app.garden.leave.recoveryTitle" : "app.garden.leave.title" },
        { gardenName }
      )}
      size="md"
      sheetSize={isOwner ? "compact" : "tall"}
      preventClose={isLeaving}
      actions={{
        primary:
          isOwner && !recovery
            ? undefined
            : {
                label: message({
                  id: recovery ? "app.garden.leave.recover" : "app.garden.leave.action",
                }),
                tone: recovery ? undefined : "danger",
                loading: isLeaving,
                disabled: !recovery && (checking || availability !== "available"),
                onClick: onConfirm,
              },
        secondary: {
          label: message({ id: "app.common.cancel" }),
          disabled: isLeaving,
          onClick: onClose,
        },
        tertiary:
          checkFailed && !recovery
            ? { label: message({ id: "app.common.retry" }), onClick: onRetry }
            : undefined,
      }}
    >
      {availability !== "available" && !recovery ? (
        <p role={availability === "checking" ? "status" : "alert"} className="mb-3">
          {message({
            id:
              availability === "checking"
                ? "app.garden.leave.availabilityChecking"
                : availability === "unavailable"
                  ? "app.garden.leave.unavailable"
                  : "app.garden.leave.availabilityFailed",
          })}
        </p>
      ) : null}
      {recovery ? (
        <p>{message({ id: "app.garden.leave.recoveryInfo" })}</p>
      ) : isOwner ? (
        <p>{message({ id: "app.garden.leave.owner" })}</p>
      ) : (
        <div className="space-y-3 type-body text-text-sub-600">
          <p>{message({ id: "app.garden.leave.effects" })}</p>
          <p>{message({ id: "app.garden.leave.queue" })}</p>
          <p>{message({ id: "app.garden.leave.obligations" })}</p>
          <p>{message({ id: "app.garden.leave.rejoin" })}</p>
        </div>
      )}
      {checking && !isOwner && !recovery ? (
        <p role="status">{message({ id: "app.garden.leave.checking" })}</p>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-3 text-error-base">
          {failure}
        </p>
      ) : null}
    </DialogShell>
  );
}
