import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import { RiCupLine, RiHandCoinLine, RiWalletLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardBody, AdminCardHeader } from "@/components/AdminCard";
import { EnsAddressText } from "@/components/EnsAddressText";
import { CookieJarDepositModal } from "./CookieJarDepositModal";
import { CookieJarWithdrawModal } from "./CookieJarWithdrawModal";

interface CookieJarPayoutPanelProps {
  gardenAddress: Address;
  routeAction?: "deposit" | "withdraw" | null;
  allocationCount?: number;
}

export const CookieJarPayoutPanel: React.FC<CookieJarPayoutPanelProps> = ({
  gardenAddress,
  routeAction,
  allocationCount = 0,
}) => {
  const { formatMessage } = useIntl();

  const {
    jars,
    isLoading: jarsLoading,
    moduleConfigured: jarsModuleConfigured,
  } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress),
  });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [selectedJarAddress, setSelectedJarAddress] = useState<Address | null>(null);
  const handledRouteActionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!routeAction || handledRouteActionRef.current === routeAction) return;

    handledRouteActionRef.current = routeAction;
    setSelectedJarAddress((jars[0]?.jarAddress as Address | undefined) ?? null);
    if (routeAction === "deposit") {
      setDepositOpen(true);
    } else {
      setWithdrawOpen(true);
    }
  }, [jars, routeAction]);

  const openDeposit = (jar: CookieJar) => {
    setSelectedJarAddress(jar.jarAddress);
    setDepositOpen(true);
  };

  const openWithdraw = (jar: CookieJar) => {
    setSelectedJarAddress(jar.jarAddress);
    setWithdrawOpen(true);
  };

  const cooldownDisplay = (seconds: bigint) => {
    const secs = Number(seconds);
    if (secs <= 0) return formatMessage({ id: "cockpit.community.payouts.noCooldown" });
    if (secs >= 86400) return `${Math.floor(secs / 86400)}d`;
    if (secs >= 3600) return `${Math.floor(secs / 3600)}h`;
    if (secs >= 60) return `${Math.floor(secs / 60)}m`;
    return `${secs}s`;
  };

  if (!jarsModuleConfigured) {
    return (
      <AdminCard density="none">
        <AdminCardBody>
          <EmptyState
            icon={<RiCupLine className="h-6 w-6" />}
            title={formatMessage({ id: "app.cookieJar.moduleNotConfigured" })}
            description={formatMessage({ id: "app.cookieJar.noJarsHint" })}
          />
        </AdminCardBody>
      </AdminCard>
    );
  }

  if (jarsLoading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <span className="sr-only">{formatMessage({ id: "app.cookieJar.loading" })}</span>
        {[0, 1].map((index) => (
          <div
            key={index}
            className="h-52 rounded-lg skeleton-shimmer"
            style={{ animationDelay: `${index * 0.08}s` }}
          />
        ))}
      </div>
    );
  }

  if (jars.length === 0) {
    return (
      <AdminCard density="none">
        <AdminCardBody>
          <EmptyState
            icon={<RiCupLine className="h-6 w-6" />}
            title={formatMessage({ id: "app.cookieJar.noJars" })}
            description={formatMessage({ id: "app.cookieJar.noJarsDescription" })}
          />
        </AdminCardBody>
      </AdminCard>
    );
  }

  return (
    <>
      <AdminCard density="none" className="overflow-hidden">
        <AdminCardHeader>
          <div>
            <h3 className="label-md text-text-strong sm:text-title-md">
              {formatMessage({
                id: "app.cookieJar.payoutTitle",
                defaultMessage: "Cookie Jars",
              })}
            </h3>
            <p className="mt-1 body-sm text-text-sub">
              {formatMessage({
                id: "app.cookieJar.payoutDescription",
                defaultMessage: "Gardeners claim rewards from cookie jars for completed work",
              })}
            </p>
          </div>
        </AdminCardHeader>

        <AdminCardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {jars.map((jar) => {
              const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
              const availableNow =
                jar.maxWithdrawal < jar.balance ? jar.maxWithdrawal : jar.balance;
              return (
                <AdminCard
                  key={jar.jarAddress}
                  variant="outlined"
                  className="flex min-h-64 flex-col gap-4 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-title-md font-semibold text-text-strong" title={symbol}>
                        {symbol}
                      </h4>
                      <p className="mt-1 text-label-sm text-text-soft">
                        <EnsAddressText address={jar.jarAddress} />
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-label-sm font-medium ${
                        jar.isPaused
                          ? "bg-warning-lighter text-warning-dark"
                          : "bg-success-lighter text-success-dark"
                      }`}
                    >
                      {jar.isPaused
                        ? formatMessage({ id: "app.cookieJar.paused" })
                        : formatMessage({ id: "app.cookieJar.active" })}
                    </span>
                  </div>

                  <div className="rounded-lg bg-bg-weak px-4 py-3">
                    <p className="text-label-sm font-medium text-text-soft">
                      {formatMessage({ id: "app.cookieJar.balance" })}
                    </p>
                    <p className="mt-1 text-headline-sm font-semibold tabular-nums text-text-strong">
                      {formatTokenAmount(jar.balance, jar.decimals)}{" "}
                      <span className="text-title-sm font-medium text-text-sub">{symbol}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-body-md">
                    <div className="rounded-md bg-bg-weak px-3 py-2">
                      <p className="body-xs text-text-soft">
                        {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}
                      </p>
                      <p className="mt-1 font-semibold tabular-nums text-text-strong">
                        {formatTokenAmount(availableNow, jar.decimals)} {symbol}
                      </p>
                    </div>
                    <div className="rounded-md bg-bg-weak px-3 py-2">
                      <p className="body-xs text-text-soft">
                        {formatMessage({ id: "app.cookieJar.withdrawalInterval" })}
                      </p>
                      <p className="mt-1 font-semibold tabular-nums text-text-strong">
                        {cooldownDisplay(jar.withdrawalInterval)}
                      </p>
                    </div>
                  </div>

                  <p className="text-body-sm text-text-sub">
                    {formatMessage(
                      { id: "cockpit.community.payouts.jarFundingContext" },
                      { count: allocationCount }
                    )}
                  </p>

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <AdminButton
                      variant="tonal"
                      size="sm"
                      leadingIcon={<RiWalletLine />}
                      onClick={() => openDeposit(jar)}
                    >
                      {formatMessage({
                        id: "app.cookieJar.deposit",
                        defaultMessage: "Deposit",
                      })}
                    </AdminButton>
                    <AdminButton
                      variant="filled"
                      size="sm"
                      leadingIcon={<RiHandCoinLine />}
                      onClick={() => openWithdraw(jar)}
                      disabled={jar.isPaused}
                    >
                      {formatMessage({
                        id: "app.cookieJar.withdraw",
                        defaultMessage: "Withdraw",
                      })}
                    </AdminButton>
                  </div>
                </AdminCard>
              );
            })}
          </div>
        </AdminCardBody>
      </AdminCard>

      <CookieJarWithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        gardenAddress={gardenAddress}
        defaultJarAddress={selectedJarAddress}
      />
      <CookieJarDepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        gardenAddress={gardenAddress}
        defaultJarAddress={selectedJarAddress}
      />
    </>
  );
};
