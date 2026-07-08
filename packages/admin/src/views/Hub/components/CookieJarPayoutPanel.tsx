import {
  type Address,
  Card,
  EmptyState,
  formatTokenAmount,
  type CookieJar,
  getVaultAssetSymbol,
  useGardenCookieJars,
} from "@green-goods/shared";
import { RiCupLine, RiHandCoinLine, RiWalletLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
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
      <Card>
        <Card.Body>
          <EmptyState
            icon={<RiCupLine className="h-6 w-6" />}
            title={formatMessage({ id: "app.cookieJar.moduleNotConfigured" })}
            description={formatMessage({ id: "app.cookieJar.noJarsHint" })}
          />
        </Card.Body>
      </Card>
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
      <Card>
        <Card.Body>
          <EmptyState
            icon={<RiCupLine className="h-6 w-6" />}
            title={formatMessage({ id: "app.cookieJar.noJars" })}
            description={formatMessage({ id: "app.cookieJar.noJarsDescription" })}
          />
        </Card.Body>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <Card.Header>
          <div>
            <h3 className="label-md text-text-strong sm:text-lg">
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
        </Card.Header>

        <Card.Body className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {jars.map((jar, index) => {
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
                      <p className="label-xs text-text-soft">
                        {formatMessage(
                          { id: "cockpit.community.payouts.jarLabel" },
                          { index: index + 1 }
                        )}
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-text-strong">{symbol}</h4>
                      <p className="mt-1 text-xs text-text-soft">
                        <EnsAddressText address={jar.jarAddress} />
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
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

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-bg-weak px-3 py-2">
                      <p className="body-xs text-text-soft">
                        {formatMessage({ id: "app.cookieJar.balance" })}
                      </p>
                      <p className="mt-1 font-semibold text-text-strong">
                        {formatTokenAmount(jar.balance, jar.decimals)} {symbol}
                      </p>
                    </div>
                    <div className="rounded-md bg-bg-weak px-3 py-2">
                      <p className="body-xs text-text-soft">
                        {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}
                      </p>
                      <p className="mt-1 font-semibold text-text-strong">
                        {formatTokenAmount(availableNow, jar.decimals)} {symbol}
                      </p>
                    </div>
                    <div className="rounded-md bg-bg-weak px-3 py-2">
                      <p className="body-xs text-text-soft">
                        {formatMessage({ id: "app.cookieJar.minDeposit" })}
                      </p>
                      <p className="mt-1 font-semibold text-text-strong">
                        {formatTokenAmount(jar.minDeposit, jar.decimals)} {symbol}
                      </p>
                    </div>
                    <div className="rounded-md bg-bg-weak px-3 py-2">
                      <p className="body-xs text-text-soft">
                        {formatMessage({ id: "app.cookieJar.withdrawalInterval" })}
                      </p>
                      <p className="mt-1 font-semibold text-text-strong">
                        {cooldownDisplay(jar.withdrawalInterval)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-text-sub">
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
        </Card.Body>
      </Card>

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
