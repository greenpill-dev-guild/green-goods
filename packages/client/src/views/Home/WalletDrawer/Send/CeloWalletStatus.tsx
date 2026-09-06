import { Button } from "@/components/Actions/Button";
import type { useCeloWallet } from "@green-goods/shared/hooks/client-ui/wallet/useCeloWallet";
import { RiErrorWarningLine } from "@remixicon/react";
import { useIntl } from "react-intl";

type CeloWallet = ReturnType<typeof useCeloWallet>;

function walletNeedsRetry(wallet: CeloWallet): boolean {
  return Boolean(
    (!wallet.deliveryEnabled && !wallet.deliveryLoading) ||
      wallet.deliveryError ||
      wallet.balanceError ||
      wallet.readiness === "unavailable" ||
      wallet.readiness === "policy-unavailable"
  );
}

export function CeloWalletStatus({
  wallet,
  showRetry = false,
}: {
  wallet: CeloWallet;
  showRetry?: boolean;
}) {
  const { formatMessage } = useIntl();
  const statusId = wallet.isOffline
    ? "app.celoWallet.offline"
    : wallet.balanceLoading || wallet.deliveryLoading || wallet.readiness === "loading"
      ? "app.celoWallet.loading"
      : wallet.deliveryError
        ? "app.celoWallet.gateError"
        : !wallet.deliveryEnabled
          ? "app.celoWallet.blocked"
          : wallet.readiness === "address-mismatch"
            ? "app.celoWallet.addressMismatch"
            : wallet.readiness === "policy-unavailable"
              ? "app.celoWallet.policyUnavailable"
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
      {showRetry && walletNeedsRetry(wallet) && !wallet.isOffline ? (
        <Button
          type="button"
          variant="neutral"
          mode="stroke"
          onClick={() => void wallet.refetch()}
          label={formatMessage({ id: "app.celoWallet.retry" })}
        />
      ) : null}
    </div>
  );
}
