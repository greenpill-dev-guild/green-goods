import { Alert } from "@green-goods/shared/components/Alert";
import type { WalletNetworkNoticeState } from "@green-goods/shared/hooks/blockchain/useWalletNetworkNotice";
import { RiWallet3Line } from "@remixicon/react";
import { AdminButton } from "@/components/AdminButton";

/**
 * Names the other network a steward's wallet is on and offers the switch, above
 * every page. Wallet acts switch the network themselves; the notice exists so a
 * browser wallet's switch prompt never arrives unannounced (PRD-1067).
 */
export function WalletNetworkNotice({ notice }: { notice: WalletNetworkNoticeState }) {
  return (
    <Alert
      variant="warning"
      className="mb-3 p-3"
      icon={<RiWallet3Line className="h-5 w-5 flex-shrink-0" aria-hidden="true" />}
      action={
        <AdminButton
          variant="outlined"
          size="sm"
          loading={notice.isSwitching}
          onClick={() => void notice.switchNetwork()}
        >
          {notice.switchLabel}
        </AdminButton>
      }
    >
      {notice.message}
    </Alert>
  );
}
