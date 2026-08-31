import { useIntl } from "react-intl";
import { AdminConfirmDialog, type AdminDialogProps } from "@/components/AdminDialog";

export interface CommitmentExpireDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The commitment's resolved title (already falling back to "Commitment {id}"). */
  title: string;
  tone?: AdminDialogProps["tone"];
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * The expire confirmation, shared by the past-due row act and the inspector's
 * act bar. Expiry is a governing act with member-visible consequences —
 * waiting claims are superseded, the pool's reservation is released, and the
 * state is terminal — so it never fires from a bare button. The contract
 * stores no expiry reason, so this binds to AdminConfirmDialog (facts, no
 * reason field), the same shape as close/archive/reopen in PoolDialogs.
 */
export function CommitmentExpireDialog({
  isOpen,
  onClose,
  title,
  tone,
  isLoading,
  onConfirm,
}: CommitmentExpireDialogProps) {
  const { formatMessage } = useIntl();
  return (
    <AdminConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      tone={tone}
      variant="danger"
      title={formatMessage({
        id: "cockpit.garden.pool.expire.title",
        defaultMessage: "Expire This Commitment",
      })}
      description={formatMessage(
        {
          id: "cockpit.garden.pool.expire.description",
          defaultMessage:
            "“{title}” is past due. Expiring it supersedes any waiting claims and releases what the pool reserved for it. This is final — the record stays, and members see it as expired.",
        },
        { title }
      )}
      confirmLabel={formatMessage({
        id: "cockpit.garden.pool.expire.confirm",
        defaultMessage: "Expire Now",
      })}
      cancelLabel={formatMessage({
        id: "cockpit.garden.pool.expire.keep",
        defaultMessage: "Keep It Live",
      })}
      isLoading={isLoading}
      onConfirm={onConfirm}
    />
  );
}

CommitmentExpireDialog.displayName = "CommitmentExpireDialog";
