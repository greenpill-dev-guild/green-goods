import {
  useAccessibleCookieJars,
  ConfirmDialog,
  type CookieJar,
  formatTokenAmount,
  getVaultAssetSymbol,
  useCookieJarWithdraw,
  useGardens,
  useOffline,
  validateDecimalInput,
} from "@green-goods/shared";
import { RiErrorWarningLine, RiInboxLine, RiLoader4Line } from "@remixicon/react";
import React, { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { EmptyState } from "@/components/Communication";

interface JarCardProps {
  jar: CookieJar;
  gardenName: string;
}

function JarCard({ jar, gardenName }: JarCardProps) {
  const { formatMessage } = useIntl();
  const { isOnline } = useOffline();
  const withdrawMutation = useCookieJarWithdraw(jar.gardenAddress);
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [purpose, setPurpose] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const decimals = jar.decimals;
  const assetSymbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  const inputError = useMemo(
    () => validateDecimalInput(amountInput, decimals),
    [amountInput, decimals]
  );

  const parsedAmount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, decimals);
    } catch {
      return 0n;
    }
  }, [amountInput, inputError, decimals]);

  const executeWithdraw = () => {
    withdrawMutation.mutate(
      { jarAddress: jar.jarAddress, amount: parsedAmount, purpose },
      {
        onSuccess: () => {
          setAmountInput("");
          setPurpose("");
          setExpanded(false);
        },
      }
    );
  };

  return (
    <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-strong-950">
            {assetSymbol} - {formatTokenAmount(jar.balance, decimals)}
          </p>
          <p className="truncate text-xs text-text-soft-400" title={gardenName}>
            {gardenName}
          </p>
        </div>
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}:{" "}
          {formatTokenAmount(jar.maxWithdrawal, decimals)}
        </p>
      </button>

      {expanded && !jar.isPaused && (
        <div className="mt-3 space-y-2 border-t border-stroke-soft-200 pt-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={formatMessage({ id: "app.cookieJar.amount" })}
              aria-label={formatMessage({ id: "app.cookieJar.amount" })}
              aria-invalid={Boolean(inputError)}
              className={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                inputError
                  ? "border-error-base focus:border-error-base"
                  : "border-stroke-sub-300 bg-bg-white-0 focus:border-primary-base"
              }`}
            />
            <button
              type="button"
              onClick={() => {
                const max = jar.maxWithdrawal < jar.balance ? jar.maxWithdrawal : jar.balance;
                setAmountInput(formatUnits(max, decimals));
              }}
              className="min-h-11 min-w-11 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-xs font-medium text-text-sub-600 hover:bg-bg-weak-50"
            >
              {formatMessage({ id: "app.treasury.max" })}
            </button>
          </div>
          {inputError && (
            <p className="text-xs text-error-dark" role="alert">
              {formatMessage({ id: inputError })}
            </p>
          )}

          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={formatMessage({ id: "app.cookieJar.purposePlaceholder" })}
            aria-label={formatMessage({ id: "app.cookieJar.purpose" })}
            className="w-full rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20 resize-none"
            rows={2}
          />

          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={
              !isOnline ||
              parsedAmount <= 0n ||
              parsedAmount > jar.maxWithdrawal ||
              parsedAmount > jar.balance ||
              !purpose.trim() ||
              withdrawMutation.isPending
            }
            aria-busy={withdrawMutation.isPending || undefined}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2 text-sm font-medium text-text-sub-600 transition hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {withdrawMutation.isPending && (
              <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
            )}
            {formatMessage({ id: "app.cookieJar.withdraw" })}
          </button>

          <ConfirmDialog
            isOpen={showConfirm}
            onClose={() => setShowConfirm(false)}
            title={formatMessage({ id: "app.cookieJar.confirmWithdrawTitle" })}
            description={formatMessage(
              { id: "app.cookieJar.confirmWithdrawDescription" },
              { amount: formatTokenAmount(parsedAmount, decimals), asset: assetSymbol }
            )}
            confirmLabel={formatMessage({ id: "app.cookieJar.withdraw" })}
            variant="warning"
            isLoading={withdrawMutation.isPending}
            onConfirm={() => {
              setShowConfirm(false);
              executeWithdraw();
            }}
          />
        </div>
      )}
    </div>
  );
}

export const CookieJarTab: React.FC = () => {
  const { formatMessage } = useIntl();
  const {
    jars,
    isLoading,
    moduleConfigured,
    unconfirmedGardenCount,
    eligibilityErrorCount,
    hasEligibilityReadFailure,
  } = useAccessibleCookieJars();
  const { data: gardens = [] } = useGardens();

  // Group jars by garden
  const groupedJars = useMemo(() => {
    const groups = new Map<string, { gardenName: string; jars: CookieJar[] }>();
    for (const jar of jars) {
      const garden = gardens.find(
        (g) => g.tokenAddress.toLowerCase() === jar.gardenAddress.toLowerCase()
      );
      const gardenName = garden?.name ?? jar.gardenAddress;
      const key = jar.gardenAddress.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.jars.push(jar);
      } else {
        groups.set(key, { gardenName, jars: [jar] });
      }
    }
    return Array.from(groups.values());
  }, [jars, gardens]);

  if (isLoading) {
    return (
      <div className="space-y-2.5 animate-pulse p-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 flex-1 rounded bg-bg-weak-50" />
            <div className="h-3 w-16 rounded bg-bg-weak-50" />
          </div>
        ))}
      </div>
    );
  }

  if (!moduleConfigured) {
    return (
      <EmptyState
        tone="warning"
        icon={<RiErrorWarningLine />}
        title={formatMessage({ id: "app.cookieJar.moduleNotConfigured" })}
      />
    );
  }

  const accessDiagnostic =
    hasEligibilityReadFailure && unconfirmedGardenCount > 0
      ? formatMessage(
          {
            id: "app.cookieJar.walletEligibilityUnconfirmed",
            defaultMessage:
              "{count, plural, one {Could not confirm Cookie Jar access for # garden.} other {Could not confirm Cookie Jar access for # gardens.}}",
          },
          { count: eligibilityErrorCount || unconfirmedGardenCount }
        )
      : null;

  if (jars.length === 0) {
    return (
      <EmptyState
        icon={<RiInboxLine />}
        title={formatMessage({ id: "app.cookieJar.walletEmpty" })}
        description={formatMessage({ id: "app.cookieJar.walletEmptyDescription" })}
      />
    );
  }

  return (
    <div className="space-y-4 p-4">
      {accessDiagnostic && (
        <p className="rounded-md border border-stroke-soft-200 bg-bg-weak-50 px-3 py-2 text-sm text-text-soft-400">
          {accessDiagnostic}
        </p>
      )}
      {groupedJars.map((group) => (
        <div key={group.gardenName}>
          <h4
            className="mb-2 truncate text-xs font-medium text-text-soft-400 uppercase tracking-wide"
            title={group.gardenName}
          >
            {group.gardenName}
          </h4>
          <div className="space-y-2">
            {group.jars.map((jar) => (
              <JarCard key={jar.jarAddress} jar={jar} gardenName={group.gardenName} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
