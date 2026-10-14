import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { Address } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { GardenPoolTarget } from "../PoolTarget";
import type { CommitmentDialogTone } from "./commitmentDialogPresentation";

export interface ConfirmKeptDialogProps {
  open: boolean;
  onClose: () => void;
  /** Sends the confirmation; the dialog closes once it is on its way. */
  onConfirm: () => Promise<unknown>;
  tone: CommitmentDialogTone;
  chainId: number;
  /** The garden whose pool the commitment lives in. */
  poolGarden: Address;
  /** The commitment's title. */
  title: string;
  /** Who kept it: the provider this confirmation vouches for, when known. */
  keptBy: Address | null;
  /** Confirmations recorded so far, and how many close the commitment. */
  confirmationCount: number;
  confirmationThreshold: number;
  isLoading?: boolean;
}

/**
 * The review before a commitment is confirmed as kept: which commitment, in
 * which garden's pool, kept by whom, and whether this confirmation closes it
 * for good. The act is final, so it never fires from a bare button (spec C.48:
 * the Hub's acts open a dialog), and the Hub queue and the inspector share
 * this one dialog so it reads the same wherever it is taken.
 */
export function ConfirmKeptDialog({
  open,
  onClose,
  onConfirm,
  tone,
  chainId,
  poolGarden,
  title,
  keptBy,
  confirmationCount,
  confirmationThreshold,
  isLoading,
}: ConfirmKeptDialogProps) {
  const { formatMessage } = useIntl();
  const threshold = Math.max(confirmationThreshold, 1);
  const next = confirmationCount + 1;
  const closes = next >= threshold;

  return (
    <AdminConfirmDialog
      isOpen={open}
      onClose={onClose}
      tone={tone}
      title={formatMessage({
        id: "cockpit.garden.pool.confirmKept.title",
        defaultMessage: "Confirm This Commitment Kept",
      })}
      target={
        <GardenPoolTarget
          chainId={chainId}
          garden={poolGarden}
          record={title}
          party={
            keptBy
              ? {
                  label: formatMessage({
                    id: "cockpit.garden.pool.confirmKept.keptBy",
                    defaultMessage: "Kept by",
                  }),
                  value: <AddressDisplay address={keptBy} interactive={false} />,
                }
              : undefined
          }
        />
      }
      description={
        closes
          ? formatMessage({
              id: "cockpit.garden.pool.confirmKept.closes",
              defaultMessage:
                "This closes the commitment as kept, for everyone. It cannot be undone.",
            })
          : formatMessage(
              {
                id: "cockpit.garden.pool.confirmKept.counts",
                defaultMessage:
                  "Yours is confirmation {next} of the {threshold} needed, and it cannot be taken back. The commitment closes as kept when the last one lands.",
              },
              { next, threshold }
            )
      }
      confirmLabel={formatMessage({
        id: "cockpit.garden.pool.confirmKept.confirm",
        defaultMessage: "Confirm Kept",
      })}
      cancelLabel={formatMessage({
        id: "cockpit.garden.pool.confirmKept.keep",
        defaultMessage: "Not Now",
      })}
      isLoading={isLoading}
      onConfirm={async () => {
        await onConfirm();
        onClose();
      }}
      // A failed send is already reported by the queue's toast; the dialog
      // stays open with the same facts so trying again costs nothing.
      onError={() => undefined}
    />
  );
}
