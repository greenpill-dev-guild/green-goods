import {
  type Address,
  AssetSelector,
  formatTokenAmount,
  type GardenVault,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  type VaultDeposit,
  validateDecimalInput,
} from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { MyDepositRow } from "./MyDepositRow";

export interface TreasuryTabContentProps {
  isOnline: boolean;
  vaults: GardenVault[];
  vaultsLoading: boolean;
  vaultsError: boolean;
  refetchVaults?: () => void;
  myDeposits: VaultDeposit[];
  gardenAddress: Address;
  primaryAddress: string | null;
  selectedAsset: string;
  onSelectAsset: (asset: string) => void;
  amountInput: string;
  onAmountChange: (value: string) => void;
  balance: { value: bigint; decimals: number; symbol: string } | undefined;
  previewShares: bigint | undefined;
  decimals: number;
}

export function TreasuryTabContent({
  isOnline,
  vaults,
  vaultsLoading,
  vaultsError,
  refetchVaults,
  myDeposits,
  gardenAddress,
  primaryAddress,
  selectedAsset,
  onSelectAsset,
  amountInput,
  onAmountChange,
  balance,
  previewShares,
  decimals,
}: TreasuryTabContentProps) {
  const { formatMessage } = useIntl();

  const inputError = useMemo(
    () => validateDecimalInput(amountInput, decimals),
    [amountInput, decimals]
  );

  return (
    <div className="space-y-5 p-4 pb-4">
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
            className="mt-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover active:scale-95"
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
                      {formatMessage({ id: "app.treasury.depositorCount" })}: {vault.depositorCount}
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

        {!primaryAddress ? (
          <p className="mt-2 text-sm text-text-soft">
            {formatMessage({ id: "app.treasury.connectToDeposit" })}
          </p>
        ) : (
          <>
            {vaults.length > 0 && (
              <div className="mt-2">
                <AssetSelector
                  vaults={vaults}
                  selectedAsset={selectedAsset}
                  onSelect={onSelectAsset}
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
                  onChange={(event) => onAmountChange(event.target.value)}
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
                    onAmountChange(formatUnits(balance.value, balance.decimals));
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
                {previewShares !== undefined ? formatTokenAmount(previewShares, 18) : "--"}
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
