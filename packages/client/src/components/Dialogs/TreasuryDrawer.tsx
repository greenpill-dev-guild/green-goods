import {
  type Address,
  type CookieJar,
  type GardenVault,
  type VaultDeposit,
  AssetSelector,
  ConfirmDialog,
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  validateDecimalInput,
  useCookieJarWithdraw,
  useGardenCookieJars,
  useGardenVaults,
  useOffline,
  useUser,
  useVaultDeposit,
  useVaultDeposits,
  useDebouncedValue,
  useVaultPreview,
  useVaultWithdraw,
} from "@green-goods/shared";
import { useBalance } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { type ModalDrawerTab, ModalDrawer } from "./ModalDrawer";

interface TreasuryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  gardenName: string;
}

interface MyDepositRowProps {
  deposit: VaultDeposit;
  vault: GardenVault;
  gardenAddress: Address;
}

function MyDepositRow({ deposit, vault, gardenAddress }: MyDepositRowProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { isOnline } = useOffline();
  const withdrawMutation = useVaultWithdraw();
  const [sharesInput, setSharesInput] = useState("");
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const maxShares = deposit.shares;
  const inputError = useMemo(() => validateDecimalInput(sharesInput, 18), [sharesInput]);

  const parsedShares = useMemo(() => {
    if (!sharesInput.trim() || inputError) return 0n;
    try {
      return parseUnits(sharesInput, 18);
    } catch {
      return 0n;
    }
  }, [sharesInput, inputError]);

  const assetDecimals = getVaultAssetDecimals(vault.asset, vault.chainId);
  const assetSymbol = getVaultAssetSymbol(vault.asset, vault.chainId);
  const debouncedShares = useDebouncedValue(parsedShares, 300);

  const { preview } = useVaultPreview({
    vaultAddress: vault.vaultAddress,
    shares: debouncedShares,
    userAddress: primaryAddress as Address | undefined,
    enabled: Boolean(primaryAddress && debouncedShares > 0n),
  });

  const executeWithdraw = () => {
    if (!primaryAddress || parsedShares <= 0n || parsedShares > maxShares) return;

    withdrawMutation.mutate(
      {
        gardenAddress,
        assetAddress: vault.asset,
        vaultAddress: vault.vaultAddress,
        shares: parsedShares,
        owner: primaryAddress as Address,
        receiver: primaryAddress as Address,
      },
      { onSuccess: () => setSharesInput("") }
    );
  };

  return (
    <div className="rounded-lg border border-stroke-soft bg-bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-strong">{assetSymbol}</p>
        <p className="text-xs text-text-sub">
          {formatMessage({ id: "app.treasury.myShares" })}: {formatTokenAmount(maxShares, 18)}
        </p>
      </div>

      <p className="mb-2 text-xs text-text-soft">
        {formatMessage({ id: "app.treasury.shareValue" })}:{" "}
        {preview ? formatTokenAmount(preview.previewAssets, assetDecimals) : "--"}
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={sharesInput}
          onChange={(event) => setSharesInput(event.target.value)}
          placeholder={formatMessage({ id: "app.treasury.withdrawShares" })}
          aria-label={formatMessage({ id: "app.treasury.withdrawShares" })}
          aria-invalid={Boolean(inputError)}
          className={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
            inputError
              ? "border-error-base focus:border-error-base"
              : "border-stroke-sub bg-bg-white focus:border-primary-base"
          }`}
        />
        <button
          type="button"
          onClick={() => setSharesInput(formatUnits(maxShares, 18))}
          className="min-h-11 min-w-11 rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-xs font-medium text-text-sub hover:bg-bg-weak"
        >
          {formatMessage({ id: "app.treasury.max" })}
        </button>
      </div>
      {inputError && (
        <p className="mt-1 text-xs text-error-dark" role="alert">
          {formatMessage({ id: inputError })}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowWithdrawConfirm(true)}
        disabled={
          !isOnline || parsedShares <= 0n || parsedShares > maxShares || withdrawMutation.isPending
        }
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60"
      >
        {withdrawMutation.isPending
          ? formatMessage({ id: "app.treasury.withdrawing" })
          : formatMessage({ id: "app.treasury.withdraw" })}
      </button>

      <ConfirmDialog
        isOpen={showWithdrawConfirm}
        onClose={() => setShowWithdrawConfirm(false)}
        title={formatMessage({ id: "app.treasury.confirmWithdrawTitle" })}
        description={formatMessage(
          { id: "app.treasury.confirmWithdrawDescription" },
          {
            shares: formatTokenAmount(parsedShares, 18),
            asset: assetSymbol,
            estimatedValue: preview
              ? formatTokenAmount(preview.previewAssets, assetDecimals)
              : "--",
          }
        )}
        confirmLabel={formatMessage({ id: "app.treasury.confirmWithdrawAction" })}
        variant="warning"
        isLoading={withdrawMutation.isPending}
        onConfirm={() => {
          setShowWithdrawConfirm(false);
          executeWithdraw();
        }}
      />
    </div>
  );
}

interface CookieJarCardProps {
  jar: CookieJar;
  gardenAddress: Address;
}

function CookieJarCard({ jar, gardenAddress }: CookieJarCardProps) {
  const { formatMessage } = useIntl();
  const { isOnline } = useOffline();
  const withdrawMutation = useCookieJarWithdraw(gardenAddress);
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [purpose, setPurpose] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const decimals = 18;
  const assetSymbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  const inputError = useMemo(() => validateDecimalInput(amountInput, decimals), [amountInput]);

  const parsedAmount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, decimals);
    } catch {
      return 0n;
    }
  }, [amountInput, inputError]);

  const cooldownSeconds = Number(jar.withdrawalInterval);
  const cooldownDisplay =
    cooldownSeconds >= 86400
      ? `${Math.floor(cooldownSeconds / 86400)}d`
      : cooldownSeconds >= 3600
        ? `${Math.floor(cooldownSeconds / 3600)}h`
        : `${cooldownSeconds}s`;

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
    <div className="rounded-lg border border-stroke-soft bg-bg-white p-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text-strong">{assetSymbol}</p>
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
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
        <p className="text-xs text-text-sub">{formatTokenAmount(jar.balance, decimals)}</p>
      </button>

      <div className="mt-2 flex gap-3 text-xs text-text-soft">
        <span>
          {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}:{" "}
          {formatTokenAmount(jar.maxWithdrawal, decimals)}
        </span>
        <span>
          {formatMessage({ id: "app.cookieJar.withdrawalInterval" })}: {cooldownDisplay}
        </span>
      </div>

      {expanded && !jar.isPaused && (
        <div className="mt-3 space-y-2 border-t border-stroke-soft pt-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={formatMessage({ id: "app.cookieJar.amount" })}
              aria-label={formatMessage({ id: "app.cookieJar.amount" })}
              aria-invalid={Boolean(inputError)}
              className={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                inputError
                  ? "border-error-base focus:border-error-base"
                  : "border-stroke-sub bg-bg-white focus:border-primary-base"
              }`}
            />
            <button
              type="button"
              onClick={() => {
                const max = jar.maxWithdrawal < jar.balance ? jar.maxWithdrawal : jar.balance;
                setAmountInput(formatUnits(max, decimals));
              }}
              className="min-h-11 min-w-11 rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-xs font-medium text-text-sub hover:bg-bg-weak"
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
            className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20 resize-none"
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60"
          >
            {withdrawMutation.isPending
              ? formatMessage({ id: "app.cookieJar.withdrawing" })
              : formatMessage({ id: "app.cookieJar.withdraw" })}
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

function CookieJarTabContent({ gardenAddress }: { gardenAddress: Address }) {
  const { formatMessage } = useIntl();
  const { jars, isLoading } = useGardenCookieJars(gardenAddress);

  if (isLoading) {
    return (
      <div className="space-y-2.5 animate-pulse p-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 flex-1 rounded bg-bg-weak" />
            <div className="h-3 w-16 rounded bg-bg-weak" />
          </div>
        ))}
      </div>
    );
  }

  if (jars.length === 0) {
    return (
      <p className="p-4 text-sm text-text-soft">{formatMessage({ id: "app.cookieJar.noJars" })}</p>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {jars.map((jar) => (
        <CookieJarCard key={jar.jarAddress} jar={jar} gardenAddress={gardenAddress} />
      ))}
    </div>
  );
}

export function TreasuryDrawer({
  isOpen,
  onClose,
  gardenAddress,
  gardenName,
}: TreasuryDrawerProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { isOnline } = useOffline();
  const depositMutation = useVaultDeposit();
  const [activeTab, setActiveTab] = useState("treasury");

  const {
    vaults,
    isLoading: vaultsLoading,
    isError: vaultsError,
    refetch: refetchVaults,
  } = useGardenVaults(gardenAddress, { enabled: isOpen });
  const { deposits } = useVaultDeposits(gardenAddress, {
    userAddress: primaryAddress ?? undefined,
    enabled: isOpen && Boolean(primaryAddress),
  });

  const [selectedAsset, setSelectedAsset] = useState("");
  const [amountInput, setAmountInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(vaults[0]?.asset ?? "");
    setAmountInput("");
    setActiveTab("treasury");
  }, [isOpen, vaults]);

  const selectedVault = useMemo(
    () => vaults.find((vault) => vault.asset.toLowerCase() === selectedAsset.toLowerCase()),
    [selectedAsset, vaults]
  );

  const { data: balance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedVault?.asset as Address | undefined,
    query: { enabled: isOpen && Boolean(primaryAddress && selectedVault) },
  });

  const decimals =
    balance?.decimals ?? getVaultAssetDecimals(selectedAsset, selectedVault?.chainId);
  const inputError = useMemo(
    () => validateDecimalInput(amountInput, decimals),
    [amountInput, decimals]
  );

  const amount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, decimals);
    } catch {
      return 0n;
    }
  }, [amountInput, decimals, inputError]);

  const debouncedAmount = useDebouncedValue(amount, 300);

  const { preview } = useVaultPreview({
    vaultAddress: selectedVault?.vaultAddress as Address | undefined,
    amount: debouncedAmount,
    userAddress: primaryAddress as Address | undefined,
    enabled: isOpen && Boolean(selectedVault && debouncedAmount > 0n),
  });

  const myDeposits = useMemo(() => deposits.filter((deposit) => deposit.shares > 0n), [deposits]);

  const onDeposit = () => {
    if (!selectedVault || !primaryAddress || amount <= 0n) return;

    depositMutation.mutate(
      {
        gardenAddress,
        assetAddress: selectedVault.asset,
        vaultAddress: selectedVault.vaultAddress,
        amount,
        receiver: primaryAddress as Address,
      },
      { onSuccess: () => setAmountInput("") }
    );
  };

  const tabs: ModalDrawerTab[] = [
    { id: "treasury", label: formatMessage({ id: "app.treasury.title" }) },
    { id: "cookie-jar", label: formatMessage({ id: "app.cookieJar.title" }) },
  ];

  return (
    <ModalDrawer
      isOpen={isOpen}
      onClose={onClose}
      header={{ title: formatMessage({ id: "app.treasury.title" }), description: gardenName }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      contentClassName="overflow-y-auto p-0"
      maxHeight="95vh"
    >
      {activeTab === "treasury" && (
        <div className="space-y-5 p-4 pb-6">
          {!isOnline && (
            <p
              role="status"
              className="rounded-md border border-warning-light bg-warning-lighter px-3 py-2 text-xs text-warning-dark"
            >
              {formatMessage({ id: "app.treasury.offlineWarning" })}
            </p>
          )}

          {vaultsError && (
            <div
              role="alert"
              className="rounded-md border border-error-light bg-error-lighter px-3 py-2 text-xs text-error-dark"
            >
              <p>{formatMessage({ id: "app.treasury.errorLoading" })}</p>
              <button
                type="button"
                onClick={() => refetchVaults?.()}
                className="mt-2 rounded-lg bg-primary-base px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover active:scale-95"
              >
                {formatMessage({ id: "app.common.tryAgain" })}
              </button>
            </div>
          )}

          <section>
            <h3 className="text-sm font-semibold text-text-strong">
              {formatMessage({ id: "app.treasury.overview" })}
            </h3>
            {vaultsLoading && (
              <div className="mt-2 space-y-2.5 animate-pulse">
                {Array.from({ length: 2 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-3 flex-1 rounded bg-bg-weak" />
                    <div className="h-3 w-16 rounded bg-bg-weak" />
                  </div>
                ))}
              </div>
            )}
            {!vaultsLoading && vaults.length === 0 && (
              <p className="mt-2 text-sm text-text-soft">
                {formatMessage({ id: "app.treasury.noVault" })}
              </p>
            )}
            {!vaultsLoading && vaults.length > 0 && (
              <div className="mt-2 space-y-2">
                {vaults.map((vault) => {
                  const assetDecimals = getVaultAssetDecimals(vault.asset, vault.chainId);
                  return (
                    <div
                      key={vault.id}
                      className="rounded-lg border border-stroke-soft bg-bg-white p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text-strong">
                          {getVaultAssetSymbol(vault.asset, vault.chainId)}
                        </p>
                        <p className="text-xs text-text-sub">
                          {formatMessage({ id: "app.treasury.depositorCount" })}:{" "}
                          {vault.depositorCount}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-text-sub">
                        {formatMessage({ id: "app.treasury.netDeposited" })}:{" "}
                        {formatTokenAmount(
                          getNetDeposited(vault.totalDeposited, vault.totalWithdrawn),
                          assetDecimals
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-text-strong">
              {formatMessage({ id: "app.treasury.activeDeposits" })}
            </h3>
            {myDeposits.length === 0 && (
              <p className="mt-2 text-sm text-text-soft">
                {formatMessage({ id: "app.treasury.supportGardenCta" })}
              </p>
            )}
            {myDeposits.length > 0 && (
              <div className="mt-2 space-y-2">
                {myDeposits.map((deposit) => {
                  const vault = vaults.find(
                    (candidate) =>
                      candidate.vaultAddress.toLowerCase() === deposit.vaultAddress.toLowerCase()
                  );
                  if (!vault) return null;

                  return (
                    <MyDepositRow
                      key={deposit.id}
                      deposit={deposit}
                      vault={vault}
                      gardenAddress={gardenAddress}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-text-strong">
              {formatMessage({ id: "app.treasury.deposit" })}
            </h3>

            {vaults.length > 0 && (
              <div className="mt-2">
                <AssetSelector
                  vaults={vaults}
                  selectedAsset={selectedAsset}
                  onSelect={setSelectedAsset}
                  ariaLabel={formatMessage({ id: "app.treasury.asset" })}
                  size="xs"
                />
              </div>
            )}

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  placeholder={formatMessage({ id: "app.treasury.depositAmount" })}
                  aria-label={formatMessage({ id: "app.treasury.depositAmount" })}
                  aria-invalid={Boolean(inputError)}
                  className={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                    inputError
                      ? "border-error-base focus:border-error-base"
                      : "border-stroke-sub bg-bg-white focus:border-primary-base"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!balance) return;
                    setAmountInput(formatUnits(balance.value, balance.decimals));
                  }}
                  className="min-h-11 min-w-11 rounded-md border border-stroke-sub bg-bg-white px-3 py-2.5 text-xs font-medium text-text-sub hover:bg-bg-weak"
                >
                  {formatMessage({ id: "app.treasury.max" })}
                </button>
              </div>

              {inputError && (
                <p className="text-xs text-error-dark" role="alert">
                  {formatMessage({ id: inputError })}
                </p>
              )}
              <p className="text-xs text-text-soft">
                {formatMessage({ id: "app.treasury.walletBalance" })}:{" "}
                {balance
                  ? `${formatTokenAmount(balance.value, balance.decimals)} ${balance.symbol}`
                  : "--"}
              </p>
              <p className="text-xs text-text-soft">
                {formatMessage({ id: "app.treasury.estimatedShares" })}:{" "}
                {preview ? formatTokenAmount(preview.previewShares, 18) : "--"}
              </p>
            </div>

            <button
              type="button"
              onClick={onDeposit}
              disabled={
                !isOnline ||
                !selectedVault ||
                !primaryAddress ||
                amount <= 0n ||
                amount > (balance?.value ?? 0n) ||
                depositMutation.isPending
              }
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
            >
              {depositMutation.isPending
                ? formatMessage({ id: "app.treasury.depositing" })
                : formatMessage({ id: "app.treasury.deposit" })}
            </button>
          </section>
        </div>
      )}

      {activeTab === "cookie-jar" && <CookieJarTabContent gardenAddress={gardenAddress} />}
    </ModalDrawer>
  );
}
