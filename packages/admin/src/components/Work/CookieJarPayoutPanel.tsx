import {
  type Address,
  type CookieJar,
  ConfirmDialog,
  formatTokenAmount,
  getVaultAssetSymbol,
  useCookieJarDeposit,
  useCookieJarEmergencyWithdraw,
  useCookieJarPause,
  useCookieJarUnpause,
  useCookieJarUpdateInterval,
  useCookieJarUpdateMaxWithdrawal,
  useCookieJarWithdraw,
  useGardenCookieJars,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { useBalance } from "wagmi";
import * as Accordion from "@radix-ui/react-accordion";
import { RiArrowDownSLine, RiCupLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { Card } from "@/components/ui/Card";

interface CookieJarPayoutPanelProps {
  gardenAddress: Address;
  canManage: boolean;
  isOwner: boolean;
}

interface JarLimitDraft {
  maxWithdrawal: string;
  withdrawalInterval: string;
}

function parseAmountToUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const base = 10n ** BigInt(decimals);
  const wholeUnits = BigInt(wholePart || "0") * base;
  const normalizedFraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);
  const fractionUnits = normalizedFraction ? BigInt(normalizedFraction) : 0n;

  return wholeUnits + fractionUnits;
}

export const CookieJarPayoutPanel: React.FC<CookieJarPayoutPanelProps> = ({
  gardenAddress,
  canManage,
  isOwner,
}) => {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const {
    jars,
    isLoading: jarsLoading,
    moduleConfigured: jarsModuleConfigured,
  } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress),
  });

  // Withdraw state (primary action)
  const withdrawMutation = useCookieJarWithdraw(gardenAddress);
  const [withdrawJar, setWithdrawJar] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPurpose, setWithdrawPurpose] = useState("");
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  // Deposit state
  const depositMutation = useCookieJarDeposit(gardenAddress);
  const [depositJar, setDepositJar] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState("");

  // Admin mutations
  const pauseMutation = useCookieJarPause(gardenAddress);
  const unpauseMutation = useCookieJarUnpause(gardenAddress);
  const updateMaxWithdrawalMutation = useCookieJarUpdateMaxWithdrawal(gardenAddress);
  const updateIntervalMutation = useCookieJarUpdateInterval(gardenAddress);
  const emergencyWithdrawMutation = useCookieJarEmergencyWithdraw(gardenAddress);
  const [emergencyJar, setEmergencyJar] = useState<CookieJar | null>(null);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, JarLimitDraft>>({});

  const selectedWithdrawJar = useMemo(
    () => jars.find((j) => j.jarAddress === withdrawJar),
    [jars, withdrawJar]
  );
  const selectedDepositJar = useMemo(
    () => jars.find((j) => j.jarAddress === depositJar),
    [jars, depositJar]
  );

  const { data: walletBalance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedDepositJar?.assetAddress as Address | undefined,
    query: { enabled: Boolean(primaryAddress && selectedDepositJar) },
  });

  const withdrawDecimals = selectedWithdrawJar?.decimals ?? 18;
  const depositDecimals = selectedDepositJar?.decimals ?? 18;

  const withdrawInputError = useMemo(
    () => validateDecimalInput(withdrawAmount, withdrawDecimals),
    [withdrawAmount, withdrawDecimals]
  );
  const depositInputError = useMemo(
    () => validateDecimalInput(depositAmount, depositDecimals),
    [depositAmount, depositDecimals]
  );

  const parsedWithdrawAmount = useMemo(() => {
    if (!withdrawAmount.trim() || withdrawInputError) return 0n;
    try {
      return parseAmountToUnits(withdrawAmount, withdrawDecimals);
    } catch {
      return 0n;
    }
  }, [withdrawAmount, withdrawInputError, withdrawDecimals]);

  const parsedDepositAmount = useMemo(() => {
    if (!depositAmount.trim() || depositInputError) return 0n;
    try {
      return parseAmountToUnits(depositAmount, depositDecimals);
    } catch {
      return 0n;
    }
  }, [depositAmount, depositInputError, depositDecimals]);

  const cooldownDisplay = (seconds: bigint) => {
    const secs = Number(seconds);
    if (secs >= 86400) return `${Math.floor(secs / 86400)}d`;
    if (secs >= 3600) return `${Math.floor(secs / 3600)}h`;
    if (secs >= 60) return `${Math.floor(secs / 60)}m`;
    return `${secs}s`;
  };

  const getJarLimitDraft = (jar: CookieJar): JarLimitDraft =>
    limitDrafts[jar.jarAddress] ?? {
      maxWithdrawal: formatUnits(jar.maxWithdrawal, jar.decimals),
      withdrawalInterval: jar.withdrawalInterval.toString(),
    };

  const updateJarLimitDraft = (jar: CookieJar, patch: Partial<JarLimitDraft>) => {
    setLimitDrafts((current) => ({
      ...current,
      [jar.jarAddress]: {
        ...getJarLimitDraft(jar),
        ...patch,
      },
    }));
  };

  const handleUpdateJarLimits = async (jar: CookieJar) => {
    const draft = getJarLimitDraft(jar);
    const maxWithdrawalError = validateDecimalInput(draft.maxWithdrawal, jar.decimals);
    const parsedInterval = /^\d+$/.test(draft.withdrawalInterval.trim())
      ? BigInt(draft.withdrawalInterval.trim())
      : null;

    if (maxWithdrawalError || !draft.maxWithdrawal.trim() || parsedInterval === null) return;

    try {
      const parsedMaxWithdrawal = parseAmountToUnits(draft.maxWithdrawal, jar.decimals);
      let nextDraft: JarLimitDraft = {
        maxWithdrawal: formatUnits(jar.maxWithdrawal, jar.decimals),
        withdrawalInterval: jar.withdrawalInterval.toString(),
      };

      if (parsedMaxWithdrawal !== jar.maxWithdrawal) {
        await updateMaxWithdrawalMutation.mutateAsync({
          jarAddress: jar.jarAddress,
          maxWithdrawal: parsedMaxWithdrawal,
        });
        nextDraft = {
          ...nextDraft,
          maxWithdrawal: formatUnits(parsedMaxWithdrawal, jar.decimals),
        };
        setLimitDrafts((current) => ({
          ...current,
          [jar.jarAddress]: nextDraft,
        }));
      }

      if (parsedInterval !== jar.withdrawalInterval) {
        await updateIntervalMutation.mutateAsync({
          jarAddress: jar.jarAddress,
          withdrawalInterval: parsedInterval,
        });
        nextDraft = {
          ...nextDraft,
          withdrawalInterval: parsedInterval.toString(),
        };
        setLimitDrafts((current) => ({
          ...current,
          [jar.jarAddress]: nextDraft,
        }));
      }
    } catch {
      // Mutation hooks surface user-visible errors via toasts.
    }
  };

  const parseDraftMaxWithdrawal = (draft: JarLimitDraft, jar: CookieJar): bigint | null => {
    if (!draft.maxWithdrawal.trim()) return null;
    if (validateDecimalInput(draft.maxWithdrawal, jar.decimals)) return null;

    try {
      return parseAmountToUnits(draft.maxWithdrawal, jar.decimals);
    } catch {
      return null;
    }
  };

  // Return null when module not configured, still loading, or no jars exist
  if (!jarsModuleConfigured || jarsLoading || jars.length === 0) return null;

  return (
    <>
      <Card className="overflow-hidden">
        {/* Header: Gardener Payouts with balance badges */}
        <Card.Header>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-lighter">
                <RiCupLine className="h-5 w-5 text-warning-dark" />
              </div>
              <div>
                <h3 className="label-md text-text-strong sm:text-lg">
                  {formatMessage({ id: "app.cookieJar.payoutTitle" })}
                </h3>
                <p className="mt-0.5 text-sm text-text-sub">
                  {formatMessage({ id: "app.cookieJar.payoutDescription" })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {jars.map((jar) => {
                const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
                return (
                  <span
                    key={jar.jarAddress}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      jar.isPaused
                        ? "bg-warning-lighter text-warning-dark"
                        : "bg-success-lighter text-success-dark"
                    }`}
                  >
                    {formatTokenAmount(jar.balance, jar.decimals, Math.min(jar.decimals, 6))}{" "}
                    {symbol}
                  </span>
                );
              })}
            </div>
          </div>
        </Card.Header>

        {/* Body: Withdraw form (primary "pay gardeners" action) */}
        <Card.Body>
          <div className="space-y-3">
            <div>
              <label htmlFor="payout-jar-select" className="text-xs font-medium text-text-sub">
                {formatMessage({ id: "app.cookieJar.title" })}
              </label>
              <select
                id="payout-jar-select"
                value={withdrawJar}
                onChange={(e) => setWithdrawJar(e.target.value)}
                className="mt-1 w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
              >
                <option value="">--</option>
                {jars
                  .filter((j) => !j.isPaused)
                  .map((jar) => (
                    <option key={jar.jarAddress} value={jar.jarAddress}>
                      {getVaultAssetSymbol(jar.assetAddress, undefined)} (
                      {formatTokenAmount(jar.balance, jar.decimals, Math.min(jar.decimals, 6))})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={formatMessage({ id: "app.cookieJar.amount" })}
                aria-label={formatMessage({ id: "app.cookieJar.amount" })}
                aria-invalid={Boolean(withdrawInputError)}
                className={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                  withdrawInputError
                    ? "border-error-base focus:border-error-base"
                    : "border-stroke-sub bg-bg-white focus:border-primary-base"
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  if (!selectedWithdrawJar) return;
                  const max =
                    selectedWithdrawJar.maxWithdrawal < selectedWithdrawJar.balance
                      ? selectedWithdrawJar.maxWithdrawal
                      : selectedWithdrawJar.balance;
                  setWithdrawAmount(formatUnits(max, withdrawDecimals));
                }}
                className="min-h-11 min-w-11 rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-xs font-medium text-text-sub hover:bg-bg-weak"
              >
                {formatMessage({ id: "app.treasury.max" })}
              </button>
            </div>
            {withdrawInputError && (
              <p className="text-xs text-error-dark" role="alert">
                {formatMessage({ id: withdrawInputError })}
              </p>
            )}

            <textarea
              value={withdrawPurpose}
              onChange={(e) => setWithdrawPurpose(e.target.value)}
              placeholder={formatMessage({ id: "app.cookieJar.purposePlaceholder" })}
              aria-label={formatMessage({ id: "app.cookieJar.purpose" })}
              className="w-full resize-none rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
              rows={2}
            />

            <button
              type="button"
              onClick={() => setShowWithdrawConfirm(true)}
              disabled={
                !isOnline ||
                !selectedWithdrawJar ||
                parsedWithdrawAmount <= 0n ||
                withdrawMutation.isPending
              }
              className="inline-flex w-full items-center justify-center rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
            >
              {withdrawMutation.isPending
                ? formatMessage({ id: "app.cookieJar.withdrawing" })
                : formatMessage({ id: "app.cookieJar.withdraw" })}
            </button>
          </div>

          {/* Accordion sections for Fund and Manage */}
          <Accordion.Root type="multiple" className="mt-6">
            {/* Fund Jars */}
            <Accordion.Item value="fund" className="border-t border-stroke-soft">
              <Accordion.Trigger className="group flex w-full items-center justify-between py-3 text-sm font-medium text-text-strong transition-colors hover:text-primary-dark">
                {formatMessage({ id: "app.cookieJar.fundJars" })}
                <RiArrowDownSLine className="h-4 w-4 text-text-soft transition-transform group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
              <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="space-y-3 pb-4">
                  <div>
                    <label htmlFor="fund-jar-select" className="text-xs font-medium text-text-sub">
                      {formatMessage({ id: "app.cookieJar.title" })}
                    </label>
                    <select
                      id="fund-jar-select"
                      value={depositJar}
                      onChange={(e) => setDepositJar(e.target.value)}
                      className="mt-1 w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
                    >
                      <option value="">--</option>
                      {jars.map((jar) => (
                        <option key={jar.jarAddress} value={jar.jarAddress}>
                          {getVaultAssetSymbol(jar.assetAddress, undefined)} (
                          {formatTokenAmount(jar.balance, jar.decimals)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder={formatMessage({ id: "app.cookieJar.amount" })}
                    aria-label={formatMessage({ id: "app.cookieJar.amount" })}
                    aria-invalid={Boolean(depositInputError)}
                    className={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                      depositInputError
                        ? "border-error-base focus:border-error-base"
                        : "border-stroke-sub bg-bg-white focus:border-primary-base"
                    }`}
                  />
                  {depositInputError && (
                    <p className="text-xs text-error-dark" role="alert">
                      {formatMessage({ id: depositInputError })}
                    </p>
                  )}
                  {selectedDepositJar &&
                    !depositInputError &&
                    parsedDepositAmount > 0n &&
                    parsedDepositAmount < selectedDepositJar.minDeposit && (
                      <p className="text-xs text-error-dark" role="alert">
                        {formatMessage(
                          { id: "app.cookieJar.belowMinDeposit" },
                          {
                            amount: formatTokenAmount(
                              selectedDepositJar.minDeposit,
                              selectedDepositJar.decimals
                            ),
                            asset: getVaultAssetSymbol(selectedDepositJar.assetAddress, undefined),
                          }
                        )}
                      </p>
                    )}
                  <p className="text-xs text-text-soft">
                    {formatMessage({ id: "app.treasury.walletBalance" })}:{" "}
                    {walletBalance
                      ? `${formatTokenAmount(walletBalance.value, walletBalance.decimals)} ${walletBalance.symbol}`
                      : "--"}
                  </p>
                  {selectedDepositJar && selectedDepositJar.minDeposit > 0n && (
                    <p className="text-xs text-text-soft">
                      {formatMessage({ id: "app.cookieJar.minDeposit" })}:{" "}
                      {formatTokenAmount(
                        selectedDepositJar.minDeposit,
                        selectedDepositJar.decimals
                      )}{" "}
                      {getVaultAssetSymbol(selectedDepositJar.assetAddress, undefined)}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedDepositJar || parsedDepositAmount <= 0n) return;
                      depositMutation.mutate(
                        {
                          jarAddress: selectedDepositJar.jarAddress,
                          amount: parsedDepositAmount,
                          assetAddress: selectedDepositJar.assetAddress,
                        },
                        { onSuccess: () => setDepositAmount("") }
                      );
                    }}
                    disabled={
                      !isOnline ||
                      !selectedDepositJar ||
                      parsedDepositAmount <= 0n ||
                      (selectedDepositJar &&
                        selectedDepositJar.minDeposit > 0n &&
                        parsedDepositAmount < selectedDepositJar.minDeposit) ||
                      depositMutation.isPending
                    }
                    className="inline-flex w-full items-center justify-center rounded-md border border-stroke-sub bg-bg-white px-4 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {depositMutation.isPending
                      ? formatMessage({ id: "app.cookieJar.depositing" })
                      : formatMessage({ id: "app.cookieJar.deposit" })}
                  </button>
                </div>
              </Accordion.Content>
            </Accordion.Item>

            {/* Manage Jars (canManage-gated) */}
            {canManage && (
              <Accordion.Item value="manage" className="border-t border-stroke-soft">
                <Accordion.Trigger className="group flex w-full items-center justify-between py-3 text-sm font-medium text-text-strong transition-colors hover:text-primary-dark">
                  {formatMessage({ id: "app.cookieJar.manageJars" })}
                  <RiArrowDownSLine className="h-4 w-4 text-text-soft transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="space-y-3 pb-4">
                    {jars.map((jar) => {
                      const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
                      const draft = getJarLimitDraft(jar);
                      const maxWithdrawalError = validateDecimalInput(
                        draft.maxWithdrawal,
                        jar.decimals
                      );
                      const intervalError =
                        draft.withdrawalInterval.trim() &&
                        !/^\d+$/.test(draft.withdrawalInterval.trim())
                          ? "app.treasury.invalidAmount"
                          : null;
                      const parsedMaxWithdrawal = maxWithdrawalError
                        ? null
                        : parseDraftMaxWithdrawal(draft, jar);
                      const parsedInterval = /^\d+$/.test(draft.withdrawalInterval.trim())
                        ? BigInt(draft.withdrawalInterval.trim())
                        : null;
                      const hasLimitChanges =
                        parsedMaxWithdrawal !== null &&
                        parsedInterval !== null &&
                        (parsedMaxWithdrawal !== jar.maxWithdrawal ||
                          parsedInterval !== jar.withdrawalInterval);

                      return (
                        <div
                          key={jar.jarAddress}
                          className="rounded-md border border-stroke-soft bg-bg-weak p-3"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-text-strong">{symbol}</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (jar.isPaused) {
                                    unpauseMutation.mutate({ jarAddress: jar.jarAddress });
                                  } else {
                                    pauseMutation.mutate({ jarAddress: jar.jarAddress });
                                  }
                                }}
                                disabled={pauseMutation.isPending || unpauseMutation.isPending}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                                  jar.isPaused
                                    ? "bg-success-lighter text-success-dark hover:bg-success-light"
                                    : "bg-warning-lighter text-warning-dark hover:bg-warning-light"
                                } disabled:opacity-50`}
                              >
                                {jar.isPaused
                                  ? formatMessage({ id: "app.cookieJar.unpause" })
                                  : formatMessage({ id: "app.cookieJar.pause" })}
                              </button>
                              {isOwner && jar.emergencyWithdrawalEnabled && (
                                <button
                                  type="button"
                                  onClick={() => setEmergencyJar(jar)}
                                  className="rounded-md bg-error-lighter px-3 py-1.5 text-xs font-medium text-error-dark transition hover:bg-error-light"
                                >
                                  {formatMessage({ id: "app.cookieJar.emergencyWithdraw" })}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex gap-4 text-xs text-text-sub">
                            <span>
                              {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}:{" "}
                              {formatTokenAmount(
                                jar.maxWithdrawal,
                                jar.decimals,
                                Math.min(jar.decimals, 6)
                              )}
                            </span>
                            <span>
                              {formatMessage({ id: "app.cookieJar.withdrawalInterval" })}:{" "}
                              {cooldownDisplay(jar.withdrawalInterval)}
                            </span>
                            <span>
                              {formatMessage({ id: "app.cookieJar.balance" })}:{" "}
                              {formatTokenAmount(
                                jar.balance,
                                jar.decimals,
                                Math.min(jar.decimals, 6)
                              )}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_auto]">
                            <div className="space-y-1">
                              <label
                                htmlFor={`jar-max-withdrawal-${jar.jarAddress}`}
                                className="text-xs font-medium text-text-sub"
                              >
                                {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}
                              </label>
                              <input
                                id={`jar-max-withdrawal-${jar.jarAddress}`}
                                type="text"
                                inputMode="decimal"
                                value={draft.maxWithdrawal}
                                onChange={(event) =>
                                  updateJarLimitDraft(jar, {
                                    maxWithdrawal: event.target.value,
                                  })
                                }
                                aria-invalid={Boolean(maxWithdrawalError)}
                                className={`w-full rounded-md border px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                                  maxWithdrawalError
                                    ? "border-error-base focus:border-error-base"
                                    : "border-stroke-sub bg-bg-white focus:border-primary-base"
                                }`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label
                                htmlFor={`jar-withdrawal-interval-${jar.jarAddress}`}
                                className="text-xs font-medium text-text-sub"
                              >
                                {formatMessage({ id: "app.cookieJar.withdrawalInterval" })}
                              </label>
                              <input
                                id={`jar-withdrawal-interval-${jar.jarAddress}`}
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                value={draft.withdrawalInterval}
                                onChange={(event) =>
                                  updateJarLimitDraft(jar, {
                                    withdrawalInterval: event.target.value,
                                  })
                                }
                                aria-invalid={Boolean(intervalError)}
                                className={`w-full rounded-md border px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                                  intervalError
                                    ? "border-error-base focus:border-error-base"
                                    : "border-stroke-sub bg-bg-white focus:border-primary-base"
                                }`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                void handleUpdateJarLimits(jar);
                              }}
                              disabled={
                                !hasLimitChanges ||
                                Boolean(maxWithdrawalError || intervalError) ||
                                updateMaxWithdrawalMutation.isPending ||
                                updateIntervalMutation.isPending
                              }
                              className="self-end rounded-md bg-primary-base px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {formatMessage({ id: "app.cookieJar.updateLimits" })}
                            </button>
                          </div>
                          {maxWithdrawalError && (
                            <p className="mt-2 text-xs text-error-dark" role="alert">
                              {formatMessage({ id: maxWithdrawalError })}
                            </p>
                          )}
                          {intervalError && (
                            <p className="mt-2 text-xs text-error-dark" role="alert">
                              {formatMessage({ id: intervalError })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            )}
          </Accordion.Root>
        </Card.Body>
      </Card>

      {/* Withdraw Confirm Dialog */}
      <ConfirmDialog
        isOpen={showWithdrawConfirm}
        onClose={() => setShowWithdrawConfirm(false)}
        title={formatMessage({ id: "app.cookieJar.confirmWithdrawTitle" })}
        description={formatMessage(
          { id: "app.cookieJar.confirmWithdrawDescription" },
          {
            amount: formatTokenAmount(parsedWithdrawAmount, withdrawDecimals),
            asset: selectedWithdrawJar
              ? getVaultAssetSymbol(selectedWithdrawJar.assetAddress, undefined)
              : "",
          }
        )}
        confirmLabel={formatMessage({ id: "app.cookieJar.withdraw" })}
        variant="warning"
        isLoading={withdrawMutation.isPending}
        onConfirm={() => {
          if (!selectedWithdrawJar) return;
          setShowWithdrawConfirm(false);
          withdrawMutation.mutate(
            {
              jarAddress: selectedWithdrawJar.jarAddress,
              amount: parsedWithdrawAmount,
              purpose: withdrawPurpose,
            },
            {
              onSuccess: () => {
                setWithdrawAmount("");
                setWithdrawPurpose("");
              },
            }
          );
        }}
      />

      {/* Emergency Withdraw Confirm Dialog */}
      <ConfirmDialog
        isOpen={emergencyJar !== null}
        onClose={() => setEmergencyJar(null)}
        title={formatMessage({ id: "app.cookieJar.emergencyWithdraw" })}
        description={formatMessage(
          { id: "app.cookieJar.confirmWithdrawDescription" },
          {
            amount: emergencyJar
              ? formatTokenAmount(
                  emergencyJar.balance,
                  emergencyJar.decimals,
                  Math.min(emergencyJar.decimals, 6)
                )
              : "0",
            asset: emergencyJar ? getVaultAssetSymbol(emergencyJar.assetAddress, undefined) : "",
          }
        )}
        confirmLabel={formatMessage({ id: "app.cookieJar.emergencyWithdraw" })}
        variant="danger"
        isLoading={emergencyWithdrawMutation.isPending}
        onConfirm={() => {
          if (!emergencyJar) return;
          emergencyWithdrawMutation.mutate(
            {
              jarAddress: emergencyJar.jarAddress,
              tokenAddress: emergencyJar.assetAddress,
              amount: emergencyJar.balance,
            },
            { onSuccess: () => setEmergencyJar(null) }
          );
        }}
      />
    </>
  );
};
