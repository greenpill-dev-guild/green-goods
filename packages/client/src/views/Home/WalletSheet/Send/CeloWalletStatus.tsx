import type { useCeloWallet } from "@green-goods/shared/hooks/client-ui/wallet/useCeloWallet";
import { RiErrorWarningLine } from "@remixicon/react";
import { useIntl } from "react-intl";

type CeloWallet = ReturnType<typeof useCeloWallet>;

export function CeloWalletStatus({ wallet }: { wallet: CeloWallet }) {
  const { formatMessage } = useIntl();
  const statusId = wallet.isOffline
    ? "app.celoWallet.offline"
    : wallet.balanceLoading || wallet.readiness === "loading"
      ? "app.celoWallet.loading"
      : wallet.readiness === "address-mismatch"
        ? "app.celoWallet.addressMismatch"
        : wallet.readiness === "unavailable"
          ? "app.celoWallet.accountUnavailable"
          : wallet.token.balance === 0n
            ? "app.send.token.zeroBalance"
            : null;
  return (
    <div className="space-y-2 text-xs text-text-sub-600" role="status" aria-live="polite">
      {statusId ? (
        <p className="flex items-start gap-1.5">
          <RiErrorWarningLine className="h-4 w-4 shrink-0" aria-hidden />
          {formatMessage({ id: statusId })}
        </p>
      ) : null}
      {wallet.balanceError ? <p>{formatMessage({ id: "app.celoWallet.balanceError" })}</p> : null}
    </div>
  );
}
