import {
  Alert,
  useAccessibleCookieJars,
  ConfirmDialog,
  type CookieJar,
  formatTokenAmount,
  FormattedAmountInput,
  getVaultAssetSymbol,
  useCookieJarWithdraw,
  useFormattedAmountInput,
  useGardens,
  useOffline,
} from "@green-goods/shared";
import {
  RiArrowDownSLine,
  RiErrorWarningLine,
  RiInboxLine,
  RiLoader4Line,
  RiWifiOffLine,
} from "@remixicon/react";
import React, { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
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
  // What a gardener can actually take right now: the per-claim cap, bounded by
  // what the jar still holds.
  const claimableNow = jar.maxWithdrawal < jar.balance ? jar.maxWithdrawal : jar.balance;
  const panelId = `cookie-jar-claim-${jar.jarAddress.toLowerCase()}`;
  const amountState = useFormattedAmountInput(amountInput, decimals);
  const inputError = amountState.formatErrorId;
  const parsedAmount = amountState.parsedAmount ?? 0n;

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
        aria-expanded={expanded}
        aria-controls={panelId}
        title={gardenName}
        className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base/20"
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium text-text-strong-950">
              {formatTokenAmount(claimableNow, decimals)} {assetSymbol}
            </p>
            {jar.isPaused && (
              <span className="inline-flex shrink-0 rounded-full bg-warning-lighter px-1.5 py-0.5 text-[10px] font-medium text-warning-dark">
                {formatMessage({ id: "app.cookieJar.paused" })}
              </span>
            )}
          </div>
          {/* The group header directly above names the garden; the card keeps it
              only in the hover/AT title so it isn't restated (Rule 17). */}
          <p className="mt-0.5 truncate text-xs text-text-soft-400">
            {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}
          </p>
        </div>
        <RiArrowDownSLine
          className={`h-4 w-4 shrink-0 text-text-soft-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div id={panelId} className="mt-3 space-y-2 border-t border-stroke-soft-200 pt-3">
          <p className="text-xs text-text-soft-400">
            {formatMessage(
              { id: "app.cookieJar.jarHolds" },
              { amount: formatTokenAmount(jar.balance, decimals), asset: assetSymbol }
            )}
          </p>
          {jar.isPaused ? (
            <p className="text-sm text-warning-dark">
              {formatMessage({ id: "app.cookieJar.paused" })}
            </p>
          ) : (
            <>
              <FormattedAmountInput
                value={amountInput}
                onValueChange={setAmountInput}
                placeholder={formatMessage({ id: "app.cookieJar.amount" })}
                aria-label={formatMessage({ id: "app.cookieJar.amount" })}
                inputClassName={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                  inputError
                    ? "border-error-base focus:border-error-base"
                    : "border-stroke-sub-300 bg-bg-white-0 focus:border-primary-base"
                }`}
                endSlot={
                  <button
                    type="button"
                    onClick={() => setAmountInput(formatUnits(claimableNow, decimals))}
                    className="min-h-11 min-w-11 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-xs font-medium text-text-sub-600 hover:bg-bg-weak-50"
                  >
                    {formatMessage({ id: "app.treasury.max" })}
                  </button>
                }
                errorClassName="mt-2 text-xs text-error-dark"
                error={inputError ? formatMessage({ id: inputError }) : null}
              />

              <div className="space-y-1">
                <label
                  htmlFor={`${panelId}-purpose`}
                  className="block text-xs font-medium text-text-sub-600"
                >
                  {formatMessage({ id: "app.cookieJar.purpose" })}{" "}
                  <span aria-hidden="true" className="text-error-dark">
                    *
                  </span>
                </label>
                <textarea
                  id={`${panelId}-purpose`}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={formatMessage({ id: "app.cookieJar.purposePlaceholder" })}
                  required
                  aria-required="true"
                  className="w-full rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20 resize-none"
                  rows={2}
                />
                <p className="text-xs text-text-soft-400">
                  {formatMessage({
                    id: "app.cookieJar.purposeHelp",
                    defaultMessage:
                      "Briefly say what this claim is for. It's recorded with the payout.",
                  })}
                </p>
              </div>

              {!isOnline ? (
                <p className="text-xs text-warning-dark" role="status">
                  {formatMessage({
                    id: "app.cookieJar.withdrawOffline",
                    defaultMessage: "Offline. Claims need a connection to reach the jar.",
                  })}
                </p>
              ) : null}

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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary-base px-3 py-2 text-sm font-medium text-primary-accent-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
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
                  {
                    amount: formatTokenAmount(parsedAmount, decimals),
                    asset: assetSymbol,
                    garden: gardenName,
                  }
                )}
                confirmLabel={formatMessage({ id: "app.cookieJar.withdraw" })}
                variant="warning"
                isLoading={withdrawMutation.isPending}
                onConfirm={() => {
                  setShowConfirm(false);
                  executeWithdraw();
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const CookieJarTab: React.FC = () => {
  const { formatMessage } = useIntl();
  const { isOnline } = useOffline();
  const {
    jars,
    isLoading,
    moduleConfigured,
    unconfirmedGardenCount,
    eligibilityErrorCount,
    hasEligibilityReadFailure,
    jarAddressErrorCount,
    hasJarAddressReadFailure,
    detailErrorCount,
    hasDetailReadFailure,
    decimalsErrorCount,
    hasDecimalsReadFailure,
  } = useAccessibleCookieJars();
  const { data: gardens = [] } = useGardens();

  // Group jars by garden
  const groupedJars = useMemo(() => {
    const groups = new Map<string, { gardenName: string; jars: CookieJar[] }>();
    for (const jar of jars) {
      const garden = gardens.find(
        (g) =>
          g.id.toLowerCase() === jar.gardenAddress.toLowerCase() ||
          g.tokenAddress.toLowerCase() === jar.gardenAddress.toLowerCase()
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
      <div className="space-y-2.5 p-4" role="status">
        <p className="text-xs text-text-soft-400">
          {formatMessage({
            id: "app.cookieJar.loading",
            defaultMessage: "Checking which cookie jars you can access…",
          })}
        </p>
        <div className="space-y-2.5 animate-pulse" aria-hidden="true">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 flex-1 rounded bg-bg-weak-50" />
              <div className="h-3 w-16 rounded bg-bg-weak-50" />
            </div>
          ))}
        </div>
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
  const hasPartialReadFailure =
    hasJarAddressReadFailure || hasDetailReadFailure || hasDecimalsReadFailure;
  const readFailureCount = jarAddressErrorCount + detailErrorCount + decimalsErrorCount;
  const partialReadDiagnostic =
    hasPartialReadFailure && readFailureCount > 0
      ? formatMessage({ id: "app.cookieJar.partialReadWarning" })
      : null;
  const diagnostics = [accessDiagnostic, partialReadDiagnostic].filter(
    (message): message is string => Boolean(message)
  );
  const diagnosticBlock =
    diagnostics.length > 0 ? (
      <div className="space-y-2">
        {diagnostics.map((message) => (
          <Alert key={message} variant="warning" className="p-3">
            {message}
          </Alert>
        ))}
      </div>
    ) : null;

  if (jars.length === 0) {
    return (
      <div className="space-y-4 p-4">
        {diagnosticBlock}
        {/* Offline reads fail closed, so an empty list proves nothing — say
            offline instead of claiming there are no jars. */}
        {!isOnline ? (
          <EmptyState
            icon={<RiWifiOffLine />}
            title={formatMessage({ id: "app.cookieJar.walletOffline" })}
          />
        ) : (
          <EmptyState
            icon={<RiInboxLine />}
            title={formatMessage({ id: "app.cookieJar.walletEmpty" })}
            description={formatMessage({ id: "app.cookieJar.walletEmptyDescription" })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {diagnosticBlock}
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
