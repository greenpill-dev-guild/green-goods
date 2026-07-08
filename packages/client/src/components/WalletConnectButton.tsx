import { Button, type ButtonProps, useAuth, useUser } from "@green-goods/shared";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

export interface WalletConnectButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  /**
   * The action rendered once a wallet is connected. Omit for connect-only
   * placements (e.g. a connect panel) — when connected with no action, the
   * button renders nothing so the placement can collapse.
   */
  action?: {
    label: ReactNode;
    onClick: () => void;
  };
  /** Connect-state label; defaults to the shared connect-wallet copy. */
  connectLabel?: ReactNode;
}

/**
 * One wallet-connect affordance for the public funding flows (endow, donate,
 * claim, cookie-jar deposit). Disconnected: always enabled, triggers the
 * wallet login (auth intent "wallet", per the public-funding connect
 * contract). Connected: renders the flow's own primary action with the
 * consumer's disabled/loading state. Centralizing the switch keeps the
 * connect UX identical across editorial surfaces instead of each card
 * hand-rolling its own connect branch.
 */
export function WalletConnectButton({
  action,
  connectLabel,
  disabled,
  loading,
  ...buttonProps
}: WalletConnectButtonProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { loginWithWallet, isAuthenticating } = useAuth();

  if (!primaryAddress) {
    return (
      <Button
        {...buttonProps}
        onClick={() => loginWithWallet()}
        loading={isAuthenticating}
        disabled={isAuthenticating}
        data-component="WalletConnectButton"
        data-state="disconnected"
      >
        {connectLabel ??
          formatMessage({
            id: "public.cookies.connectWallet",
            defaultMessage: "Connect wallet",
          })}
      </Button>
    );
  }

  if (!action) return null;

  return (
    <Button
      {...buttonProps}
      onClick={action.onClick}
      disabled={disabled}
      loading={loading}
      data-component="WalletConnectButton"
      data-state="connected"
    >
      {action.label}
    </Button>
  );
}

WalletConnectButton.displayName = "WalletConnectButton";
