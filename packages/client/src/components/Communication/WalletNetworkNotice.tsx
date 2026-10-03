import { Button } from "@green-goods/shared/components/Button";
import type { WalletNetworkNoticeState } from "@green-goods/shared/hooks/blockchain/useWalletNetworkNotice";
import { RiWallet3Line } from "@remixicon/react";

/**
 * The top status bar that names the other network a wallet is on and offers
 * the switch. Wallet acts switch the network themselves; the bar exists so a
 * browser wallet's switch prompt never arrives unannounced (PRD-1067). It takes
 * the install nudge's place and its measurements, so the offline banner covers
 * both the same way.
 */
export function WalletNetworkNotice({ notice }: { notice: WalletNetworkNoticeState }) {
  return (
    <div
      className="vt-wallet-network-notice fixed left-0 right-0 top-0 z-nav flex w-full items-center justify-center gap-2 overflow-y-clip border-b border-stroke-soft-200 bg-bg-white-0/95 px-3 py-1 text-xs font-medium text-text-strong-950 shadow-sm backdrop-blur-md"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
      role="status"
      data-testid="wallet-network-notice"
    >
      <RiWallet3Line size={12} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0">{notice.message}</span>
      <Button
        type="button"
        emphasis="tertiary"
        size="compact"
        loading={notice.isSwitching}
        onClick={() => void notice.switchNetwork()}
        className="-my-2 shrink-0 text-xs"
      >
        {notice.switchLabel}
      </Button>
    </div>
  );
}
