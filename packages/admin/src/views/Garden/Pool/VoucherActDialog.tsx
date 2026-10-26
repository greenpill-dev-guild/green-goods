import { Alert } from "@green-goods/shared/components/Alert";
import type { Address } from "@green-goods/shared/types/domain";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { PersonName } from "@/components/PersonName";

/** A fact's value with its quieter line under it, as the copy's fact rows carry. */
export function FactValue({ value, note }: { value: ReactNode; note?: ReactNode }) {
  return (
    <>
      {value}
      {note ? <span className="block type-meta font-normal text-text-soft">{note}</span> : null}
    </>
  );
}

/** Names the person a dialog speaks of; a closed dialog has no one to name. */
export function WithPerson({
  address,
  children,
}: {
  address: Address | null | undefined;
  children: (name: string) => ReactNode;
}) {
  return address ? <PersonName address={address}>{children}</PersonName> : <>{children("")}</>;
}

type ConfirmDialogProps = ComponentProps<typeof AdminConfirmDialog>;

export interface VoucherActDialogProps
  extends Omit<
    ConfirmDialogProps,
    "isOpen" | "onConfirm" | "onError" | "isLoading" | "children" | "confirmLabel"
  > {
  open: boolean;
  /** The act the confirm sends; the dialog closes once it lands. */
  act: () => Promise<unknown>;
  confirmLabel: string;
  /** Who signs and how, closing the body (DL-117): the wallet's prompt or the Safe's count. */
  note: string;
  /** Where the act stands while it runs, under the note. */
  progress?: ReactNode;
  children: ReactNode;
}

/**
 * One voucher act on the cockpit's confirm dialog (V5): busy while the act
 * runs, closed when it lands, and kept open saying it didn't go through, with
 * the confirm offered again, when it fails. The body ends with who signs.
 */
export function VoucherActDialog({
  open,
  act,
  onClose,
  confirmLabel,
  note,
  progress,
  children,
  ...dialog
}: VoucherActDialogProps) {
  const { formatMessage } = useIntl();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => {
    setFailed(false);
    onClose();
  };
  return (
    <AdminConfirmDialog
      {...dialog}
      isOpen={open}
      onClose={close}
      isLoading={busy}
      confirmLabel={
        failed
          ? formatMessage({
              id: "cockpit.garden.pool.approvals.retry",
              defaultMessage: "Try Again",
            })
          : confirmLabel
      }
      onConfirm={async () => {
        setBusy(true);
        setFailed(false);
        try {
          await act();
          close();
        } finally {
          setBusy(false);
        }
      }}
      // The confirm dialog has logged it; the dialog says so and stays.
      onError={() => setFailed(true)}
    >
      <div className="space-y-4">
        {children}
        {failed ? (
          <Alert variant="error">
            {formatMessage({
              id: "app.admin.actPhase.failed",
              defaultMessage: "It didn’t go through, and nothing changed. You can try again.",
            })}
          </Alert>
        ) : null}
        <p className="type-body text-text-sub">{note}</p>
        {busy ? progress : null}
      </div>
    </AdminConfirmDialog>
  );
}
