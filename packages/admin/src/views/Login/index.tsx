import { RiPlantLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Navigate, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";

interface EthereumProviderFlags {
  isMetaMask?: boolean;
  isRabby?: boolean;
}

function detectInstalledWallets(): { hasMetaMask: boolean; hasRabby: boolean } {
  if (typeof window === "undefined") {
    return { hasMetaMask: false, hasRabby: false };
  }

  const ethereum = (
    window as { ethereum?: { providers?: EthereumProviderFlags[] } & EthereumProviderFlags }
  ).ethereum;
  const providers = ethereum?.providers ?? (ethereum ? [ethereum] : []);

  return {
    hasMetaMask: providers.some((provider) => provider.isMetaMask),
    hasRabby: providers.some((provider) => provider.isRabby),
  };
}

export default function Login() {
  const intl = useIntl();
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || "/dashboard";
  const { hasMetaMask, hasRabby } = useMemo(() => detectInstalledWallets(), []);
  const hasSupportedWallet = hasMetaMask || hasRabby;

  // Redirect once connected and have address
  if (isConnected && address) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="min-h-screen bg-bg-white flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-md w-full">
        <div className="bg-bg-soft rounded-lg shadow-2xl border border-stroke-sub p-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-success-lighter rounded-lg flex items-center justify-center mb-4">
              <RiPlantLine className="h-8 w-8 text-success-dark" />
            </div>
            <h2 className="text-3xl font-bold text-text-strong">Green Goods</h2>
            <p className="mt-2 text-sm text-text-sub">
              Garden management dashboard for the Green Goods protocol
            </p>
          </div>

          <div className="mt-8">
            <ConnectButton className="w-full" size="lg" />

            <p className="mt-4 text-xs text-text-soft text-center">
              {intl.formatMessage({
                id: "app.admin.login.walletPrompt",
                defaultMessage: "Connect your wallet to access garden management features",
              })}
            </p>

            {!hasSupportedWallet && (
              <div className="mt-4 rounded-md border border-warning-light bg-warning-lighter p-3 text-xs text-warning-dark">
                <p className="font-medium">
                  {intl.formatMessage({
                    id: "app.admin.login.noExtensionTitle",
                    defaultMessage: "No wallet extension detected",
                  })}
                </p>
                <p className="mt-1">
                  {intl.formatMessage({
                    id: "app.admin.login.noExtensionBody",
                    defaultMessage:
                      "Install MetaMask or Rabby, refresh this page, and try connecting again.",
                  })}
                </p>
                <div className="mt-2 flex gap-3">
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    MetaMask
                  </a>
                  <a
                    href="https://rabby.io/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Rabby
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
