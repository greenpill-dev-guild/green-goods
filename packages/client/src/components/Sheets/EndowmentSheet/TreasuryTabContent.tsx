import {
  TxHoldFeedback,
  type TxHoldFeedbackProps,
} from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { Button } from "@green-goods/shared/components/Button";
import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { Address } from "@green-goods/shared/types/domain";
import { AssetSelector } from "@green-goods/shared/components/Vault/AssetSelector";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import {
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import type { GardenVault, VaultDeposit } from "@green-goods/shared/types/vaults";
import { RiBankLine, RiErrorWarningLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { MyDepositRow } from "./MyDepositRow";

export interface TreasuryTabContentProps {
  isOnline: boolean;
  vaults: GardenVault[];
  vaultsLoading: boolean;
  vaultsError: boolean;
  refetchVaults?: () => void;
  myDeposits: VaultDeposit[];
  /** The reader's deposits are still being read, or the read failed: no "none yet" until it finishes. */
  depositsLoading?: boolean;
  depositsError?: boolean;
  refetchDeposits?: () => void;
  gardenAddress: Address;
  primaryAddress: string | null;
  selectedAsset: string;
  onSelectAsset: (asset: string) => void;
  amountInput: string;
  onAmountChange: (value: string) => void;
  balance: { value: bigint; decimals: number; symbol: string } | undefined;
  previewShares: bigint | undefined;
  decimals: number;
  /** An earlier deposit here whose outcome is unknown, which pauses the next one. */
  holdFeedback?: Omit<TxHoldFeedbackProps, "isBusy" | "className"> | null;
  signatureLine?: string | null;
  isDepositing?: boolean;
}

export function TreasuryTabContent({
  isOnline,
  vaults,
  vaultsLoading,
  vaultsError,
  refetchVaults,
  myDeposits,
  depositsLoading = false,
  depositsError = false,
  refetchDeposits,
  gardenAddress,
  primaryAddress,
  selectedAsset,
  onSelectAsset,
  amountInput,
  onAmountChange,
  balance,
  previewShares,
  decimals,
  holdFeedback,
  signatureLine,
  isDepositing = false,
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
              <Button type="button" onClick={() => refetchVaults()}>
                {formatMessage({ id: "app.common.tryAgain" })}
              </Button>
            ) : null
          }
        />
      )}

      <section>
        <SheetHeading>{formatMessage({ id: "app.treasury.overview" })}</SheetHeading>
        {vaultsLoading && (
          <div className="mt-2 flex animate-pulse flex-col gap-(--gg-list-gap)">
            {Array.from({ length: 2 }, (_, i) => (
              <ItemRowSkeleton key={i} lead="icon" amount />
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
          <div className="mt-2 flex flex-col gap-(--gg-list-gap)">
            {vaults.map((vault) => {
              const assetDecimals = getVaultAssetDecimals(vault.asset, vault.chainId);
              const assetSymbol = getVaultAssetSymbol(vault.asset, vault.chainId);
              // The summary has nothing to open, so each vault is a content row.
              return (
                <ItemRow
                  key={vault.id}
                  lead={{ kind: "icon", icon: <RiBankLine /> }}
                  title={assetSymbol}
                  details={[
                    formatMessage(
                      { id: "app.treasury.depositorTotal" },
                      { count: vault.depositorCount }
                    ),
                  ]}
                  amount={{
                    value: `${formatTokenAmount(
                      getNetDeposited(vault.totalDeposited, vault.totalWithdrawn),
                      assetDecimals,
                      4,
                      undefined,
                      true
                    )} ${assetSymbol}`,
                    caption: formatMessage({ id: "app.treasury.netDeposited" }),
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SheetHeading>{formatMessage({ id: "app.treasury.activeDeposits" })}</SheetHeading>
        {depositsLoading && myDeposits.length === 0 && (
          <div className="mt-2 flex animate-pulse flex-col gap-(--gg-list-gap)">
            <ItemRowSkeleton lead="icon" amount />
          </div>
        )}
        {!depositsLoading && depositsError && myDeposits.length === 0 && (
          <EmptyState
            className="mt-2"
            tone="error"
            icon={<RiErrorWarningLine />}
            title={formatMessage({ id: "app.treasury.errorLoading" })}
            action={
              refetchDeposits ? (
                <Button type="button" onClick={() => refetchDeposits()}>
                  {formatMessage({ id: "app.common.tryAgain" })}
                </Button>
              ) : null
            }
          />
        )}
        {!depositsLoading && !depositsError && myDeposits.length === 0 && (
          <EmptyState
            className="mt-2 min-h-[9rem] rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0"
            icon={<RiBankLine />}
            title={formatMessage({ id: "app.treasury.noDeposits" })}
            description={formatMessage({ id: "app.treasury.supportGardenCta" })}
          />
        )}
        {myDeposits.length > 0 && (
          <div className="mt-2 flex flex-col gap-(--gg-list-gap)">
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
        <SheetHeading>{formatMessage({ id: "app.treasury.deposit" })}</SheetHeading>

        {!primaryAddress ? (
          <p className="mt-2 text-sm text-text-soft-400">
            {formatMessage({ id: "app.treasury.connectToDeposit" })}
          </p>
        ) : (
          <>
            {holdFeedback ? (
              <TxHoldFeedback {...holdFeedback} isBusy={isDepositing} className="mt-2" />
            ) : null}
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
                <TextInput
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => onAmountChange(event.target.value)}
                  placeholder={formatMessage({ id: "app.treasury.depositAmount" })}
                  aria-label={formatMessage({ id: "app.treasury.depositAmount" })}
                  aria-invalid={Boolean(inputError)}
                  invalid={Boolean(inputError)}
                />
                <Button
                  type="button"
                  emphasis="secondary"
                  onClick={() => {
                    if (!balance) return;
                    onAmountChange(formatUnits(balance.value, balance.decimals));
                  }}
                >
                  {formatMessage({ id: "app.treasury.max" })}
                </Button>
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
              {signatureLine ? (
                <p className="text-xs text-text-soft-400" aria-live="polite">
                  {signatureLine}
                </p>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
