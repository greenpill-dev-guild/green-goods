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
  useCookieJarWithdraw,
  useGardenCookieJars,
  useGardenPermissions,
  useGardens,
  useOffline,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { useBalance } from "wagmi";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { formatUnits, parseUnits } from "viem";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function CookieJarsView() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { isOnline } = useOffline();
  const permissions = useGardenPermissions();

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((g) => g.id === id);
  const gardenAddress = (garden?.id ?? id ?? "") as Address;
  const canManage = garden ? permissions.canManageGarden(garden) : false;
  const isOwner = garden ? permissions.isOwnerOfGarden(garden) : false;

  const { jars, isLoading: jarsLoading } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress),
  });

  // Deposit state
  const depositMutation = useCookieJarDeposit(gardenAddress);
  const [depositJar, setDepositJar] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState("");

  // Withdraw state
  const withdrawMutation = useCookieJarWithdraw(gardenAddress);
  const [withdrawJar, setWithdrawJar] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPurpose, setWithdrawPurpose] = useState("");
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  // Admin mutations
  const pauseMutation = useCookieJarPause(gardenAddress);
  const unpauseMutation = useCookieJarUnpause(gardenAddress);

  // Emergency withdraw
  const emergencyWithdrawMutation = useCookieJarEmergencyWithdraw(gardenAddress);
  const [emergencyJar, setEmergencyJar] = useState<CookieJar | null>(null);

  const selectedDepositJar = useMemo(
    () => jars.find((j) => j.jarAddress === depositJar),
    [jars, depositJar]
  );
  const selectedWithdrawJar = useMemo(
    () => jars.find((j) => j.jarAddress === withdrawJar),
    [jars, withdrawJar]
  );

  const { data: walletBalance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedDepositJar?.assetAddress as Address | undefined,
    query: { enabled: Boolean(primaryAddress && selectedDepositJar) },
  });

  const depositDecimals = selectedDepositJar?.decimals ?? 18;
  const withdrawDecimals = selectedWithdrawJar?.decimals ?? 18;

  const depositInputError = useMemo(
    () => validateDecimalInput(depositAmount, depositDecimals),
    [depositAmount, depositDecimals]
  );
  const withdrawInputError = useMemo(
    () => validateDecimalInput(withdrawAmount, withdrawDecimals),
    [withdrawAmount, withdrawDecimals]
  );

  const parsedDepositAmount = useMemo(() => {
    if (!depositAmount.trim() || depositInputError) return 0n;
    try {
      return parseUnits(depositAmount, depositDecimals);
    } catch {
      return 0n;
    }
  }, [depositAmount, depositInputError, depositDecimals]);

  const parsedWithdrawAmount = useMemo(() => {
    if (!withdrawAmount.trim() || withdrawInputError) return 0n;
    try {
      return parseUnits(withdrawAmount, withdrawDecimals);
    } catch {
      return 0n;
    }
  }, [withdrawAmount, withdrawInputError, withdrawDecimals]);

  const baseHeaderProps = {
    backLink: {
      to: `/gardens/${id}`,
      label: formatMessage({ id: "app.hypercerts.backToGarden" }),
    },
    sticky: true,
  } as const;

  if (gardensLoading) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.cookieJar.title" })}
          description={formatMessage({ id: "app.garden.admin.loadingGarden" })}
          {...baseHeaderProps}
        />
      </div>
    );
  }

  if (!garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.cookieJar.title" })}
          description={formatMessage({ id: "app.garden.admin.notFound" })}
          {...baseHeaderProps}
        />
      </div>
    );
  }

  const cooldownDisplay = (seconds: bigint) => {
    const secs = Number(seconds);
    if (secs >= 86400) return `${Math.floor(secs / 86400)}d`;
    if (secs >= 3600) return `${Math.floor(secs / 3600)}h`;
    if (secs >= 60) return `${Math.floor(secs / 60)}m`;
    return `${secs}s`;
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.cookieJar.title" })}
        description={garden.name}
        {...baseHeaderProps}
      />

      <div className="mx-auto mt-6 max-w-6xl space-y-6 px-4 sm:px-6">
        {/* Section 1: Jar Overview */}
        <section>
          <h3 className="text-base font-semibold text-text-strong">
            {formatMessage({ id: "app.treasury.overview" })}
          </h3>
          {jarsLoading && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }, (_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm"
                >
                  <div className="h-4 w-24 rounded bg-bg-weak" />
                  <div className="mt-2 h-6 w-16 rounded bg-bg-weak" />
                </div>
              ))}
            </div>
          )}
          {!jarsLoading && jars.length === 0 && (
            <p className="mt-3 text-sm text-text-soft">
              {formatMessage({ id: "app.cookieJar.noJars" })}
            </p>
          )}
          {!jarsLoading && jars.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {jars.map((jar) => {
                const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
                return (
                  <div
                    key={jar.jarAddress}
                    className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text-strong">{symbol}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
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
                    <p className="mt-2 text-xl font-semibold text-text-strong">
                      {formatTokenAmount(jar.balance, jar.decimals)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-sub">
                      <span>
                        {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}:{" "}
                        {formatTokenAmount(jar.maxWithdrawal, jar.decimals)}
                      </span>
                      <span>
                        {formatMessage({ id: "app.cookieJar.withdrawalInterval" })}:{" "}
                        {cooldownDisplay(jar.withdrawalInterval)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Deposit */}
        {jars.length > 0 && (
          <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-text-strong">
              {formatMessage({ id: "app.cookieJar.deposit" })}
            </h3>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="deposit-jar-select" className="text-xs font-medium text-text-sub">
                  {formatMessage({ id: "app.cookieJar.title" })}
                </label>
                <select
                  id="deposit-jar-select"
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

              <div className="flex items-center gap-2">
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
              </div>
              {depositInputError && (
                <p className="text-xs text-error-dark" role="alert">
                  {formatMessage({ id: depositInputError })}
                </p>
              )}
              <p className="text-xs text-text-soft">
                {formatMessage({ id: "app.treasury.walletBalance" })}:{" "}
                {walletBalance
                  ? `${formatTokenAmount(walletBalance.value, walletBalance.decimals)} ${walletBalance.symbol}`
                  : "--"}
              </p>

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
                  depositMutation.isPending
                }
                className="inline-flex w-full items-center justify-center rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
              >
                {depositMutation.isPending
                  ? formatMessage({ id: "app.cookieJar.depositing" })
                  : formatMessage({ id: "app.cookieJar.deposit" })}
              </button>
            </div>
          </section>
        )}

        {/* Section 3: Withdraw */}
        {jars.length > 0 && (
          <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-text-strong">
              {formatMessage({ id: "app.cookieJar.withdraw" })}
            </h3>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="withdraw-jar-select" className="text-xs font-medium text-text-sub">
                  {formatMessage({ id: "app.cookieJar.title" })}
                </label>
                <select
                  id="withdraw-jar-select"
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
                        {formatTokenAmount(jar.balance, jar.decimals)})
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
                className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20 resize-none"
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
                className="inline-flex w-full items-center justify-center rounded-md border border-stroke-sub bg-bg-white px-4 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60"
              >
                {withdrawMutation.isPending
                  ? formatMessage({ id: "app.cookieJar.withdrawing" })
                  : formatMessage({ id: "app.cookieJar.withdraw" })}
              </button>
            </div>

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
          </section>
        )}

        {/* Section 4: Jar Management (admin-only) */}
        {canManage && jars.length > 0 && (
          <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-text-strong">
              {formatMessage({ id: "app.cookieJar.updateLimits" })}
            </h3>
            <div className="mt-3 space-y-3">
              {jars.map((jar) => {
                const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
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
                        {formatTokenAmount(jar.maxWithdrawal, jar.decimals)}
                      </span>
                      <span>
                        {formatMessage({ id: "app.cookieJar.withdrawalInterval" })}:{" "}
                        {cooldownDisplay(jar.withdrawalInterval)}
                      </span>
                      <span>
                        {formatMessage({ id: "app.cookieJar.balance" })}:{" "}
                        {formatTokenAmount(jar.balance, jar.decimals)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Emergency Withdraw Confirm */}
        <ConfirmDialog
          isOpen={emergencyJar !== null}
          onClose={() => setEmergencyJar(null)}
          title={formatMessage({ id: "app.cookieJar.emergencyWithdraw" })}
          description={formatMessage(
            { id: "app.cookieJar.confirmWithdrawDescription" },
            {
              amount: emergencyJar
                ? formatTokenAmount(emergencyJar.balance, emergencyJar.decimals)
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
      </div>
    </div>
  );
}
