import { useState } from "react";
import { useIntl } from "react-intl";
import { Alert } from "@green-goods/shared/components/Alert";
import { AdminButton } from "./AdminButton";
import { AdminConfirmDialog } from "./AdminDialog";

/** Recovery controls for an accepted creation, using the existing wallet-cancellation contract. */
export function WalletCancellationRecovery({
  onCheck,
  onConfirmCancellation,
  disabled = false,
}: {
  onCheck: () => void | Promise<void>;
  onConfirmCancellation: (confirmedInWallet: boolean) => Promise<void>;
  disabled?: boolean;
}) {
  const { formatMessage } = useIntl();
  const [review, setReview] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <AdminButton size="sm" disabled={disabled || clearing} onClick={() => void onCheck()}>
        {formatMessage({
          id: "app.account.checkConfirmation",
          defaultMessage: "Check confirmation",
        })}
      </AdminButton>
      <AdminButton
        size="sm"
        variant="text"
        disabled={disabled || clearing}
        onClick={() => {
          setFailed(false);
          setReview(true);
        }}
      >
        {formatMessage({
          id: "app.account.reviewCancellation",
          defaultMessage: "Review Cancellation",
        })}
      </AdminButton>
      <AdminConfirmDialog
        isOpen={review}
        onClose={() => setReview(false)}
        variant="warning"
        title={formatMessage({ id: "app.account.confirmCancellationTitle" })}
        description={formatMessage({ id: "app.account.confirmCancellationDescription" })}
        confirmLabel={formatMessage({ id: "app.account.confirmCancellation" })}
        isLoading={clearing}
        confirmDisabled={disabled || clearing}
        onError={() => setFailed(true)}
        onConfirm={async () => {
          setClearing(true);
          try {
            await onConfirmCancellation(true);
            setReview(false);
          } finally {
            setClearing(false);
          }
        }}
      >
        {failed && (
          <Alert variant="error">
            {formatMessage({ id: "app.account.pendingRecoveryUnavailable" })}
          </Alert>
        )}
      </AdminConfirmDialog>
    </>
  );
}
