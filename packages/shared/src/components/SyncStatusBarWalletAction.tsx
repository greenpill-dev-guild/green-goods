import { useEffect } from "react";
import { useIntl } from "react-intl";
import { useBatchWorkSync } from "../hooks/work/useBatchWorkSync";

export interface SyncStatusBarWalletActionProps {
  isOnline: boolean;
  pendingCount: number;
  onSyncingChange: (isSyncing: boolean) => void;
}

export interface SyncStatusBarWalletActionViewProps {
  isOnline: boolean;
  isPending: boolean;
  pendingCount: number;
  onSync: () => void;
}

export function SyncStatusBarWalletActionView({
  isOnline,
  isPending,
  pendingCount,
  onSync,
}: SyncStatusBarWalletActionViewProps) {
  const intl = useIntl();

  return (
    <button
      type="button"
      onClick={onSync}
      disabled={!isOnline || isPending}
      className="text-xs font-medium text-primary disabled:text-text-soft-400"
    >
      {!isOnline
        ? intl.formatMessage({
            id: "app.syncBar.reconnect",
            defaultMessage: "Reconnect to send",
          })
        : intl.formatMessage(
            {
              id: "app.syncBar.syncAll",
              defaultMessage: "Send all ({count})",
            },
            { count: pendingCount }
          )}
    </button>
  );
}

export function SyncStatusBarWalletAction({
  isOnline,
  pendingCount,
  onSyncingChange,
}: SyncStatusBarWalletActionProps) {
  const batchWorkSync = useBatchWorkSync();

  useEffect(() => {
    onSyncingChange(batchWorkSync.isPending);
    return () => onSyncingChange(false);
  }, [batchWorkSync.isPending, onSyncingChange]);

  return (
    <SyncStatusBarWalletActionView
      isOnline={isOnline}
      isPending={batchWorkSync.isPending}
      pendingCount={pendingCount}
      onSync={() => void batchWorkSync.mutateAsync()}
    />
  );
}
