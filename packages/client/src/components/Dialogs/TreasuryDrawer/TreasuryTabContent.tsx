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
import { RiBankLine, RiErrorWarningLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { EmptyState } from "@/components/Communication";
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
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={formatMessage({ id: "app.treasury.errorLoading" })}
          action={
            refetchVaults ? (
              <button
                type="button"
                onClick={() => refetchVaults()}
                className="rounded-[var(--radius-md)] bg-primary-action px-4 py-2.5 text-sm font-medium text-primary-action-foreground transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:bg-primary-action-hover active:scale-95"
              >
                {formatMessage({ id: "app.common.tryAgain" })}
              </button>
            ) : null
          }
        />
      )}

      <section>
        <h3 className="text-sm font-semibold text-text-strong-950">
          {formatMessage({ id: "app.treasury.overview" })}
        </h3>
        {vaultsLoading && (
          <div className="mt-2 space-y-2.5 animate-pulse">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 flex-1 rounded bg-bg-weak-50" />
                <div className="h-3 w-16 rounded bg-bg-weak-50" />
              </div>
            ))}
          </div>
        )}
        {!vaultsLoading && vaults.length === 0 && (
          <EmptyState
            className="mt-2 min-h-[9rem] rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0"
            icon={<RiBankLine />}
            title={formatMessage({ id: "app.treasury.noVault" })}
          />
        )}
        {!vaultsLoading && vaults.length > 0 && (
          <div className="mt-2 space-y-2">
            {vaults.map((vault) => {
              const assetDecimals = getVaultAssetDecimals(vault.asset, vault.chainId);
              return (
                <div
                  key={vault.id}
                  className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-strong-950">
                      {getVaultAssetSymbol(vault.asset, vault.chainId)}
                    </p>
                    <p className="text-xs text-text-sub-600">
                      {formatMessage({ id: "app.treasury.depositorCount" })}: {vault.depositorCount}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-text-sub-600">
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
        <h3 className="text-sm font-semibold text-text-strong-950">
          {formatMessage({ id: "app.treasury.activeDeposits" })}
        </h3>
        {myDeposits.length === 0 && (
          <p className="mt-2 text-sm text-text-soft-400">
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
        <h3 className="text-sm font-semibold text-text-strong-950">
          {formatMessage({ id: "app.treasury.deposit" })}
        </h3>

        {!primaryAddress ? (
          <p className="mt-2 text-sm text-text-soft-400">
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
                  className={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                    inputError
                      ? "border-error-base focus:border-error-base"
                      : "border-stroke-sub-300 bg-bg-white-0 focus:border-primary-base"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!balance) return;
                    onAmountChange(formatUnits(balance.value, balance.decimals));
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
              <p className="text-xs text-text-soft-400">
                {formatMessage({ id: "app.treasury.walletBalance" })}:{" "}
                {balance
                  ? `${formatTokenAmount(balance.value, balance.decimals)} ${balance.symbol}`
                  : "--"}
              </p>
              <p className="text-xs text-text-soft-400">
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
