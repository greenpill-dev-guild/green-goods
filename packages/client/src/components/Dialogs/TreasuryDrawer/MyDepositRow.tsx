import {
  type Address,
  ConfirmDialog,
  formatTokenAmount,
  type GardenVault,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  useDebouncedValue,
  useOffline,
  useUser,
  useVaultPreview,
  useVaultWithdraw,
  type VaultDeposit,
  validateDecimalInput,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";

export interface MyDepositRowProps {
  deposit: VaultDeposit;
  vault: GardenVault;
  gardenAddress: Address;
}

export function MyDepositRow({ deposit, vault, gardenAddress }: MyDepositRowProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { isOnline } = useOffline();
  const withdrawMutation = useVaultWithdraw();
  const [amountInput, setAmountInput] = useState("");
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const assetDecimals = getVaultAssetDecimals(vault.asset, vault.chainId);
  const assetSymbol = getVaultAssetSymbol(vault.asset, vault.chainId);
  const inputError = useMemo(
    () => validateDecimalInput(amountInput, assetDecimals),
    [amountInput, assetDecimals]
  );

  const parsedAmount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, assetDecimals);
    } catch {
      return 0n;
    }
  }, [amountInput, inputError, assetDecimals]);

  const debouncedAmount = useDebouncedValue(parsedAmount, 300);

  const { preview } = useVaultPreview({
    vaultAddress: vault.vaultAddress,
    amount: debouncedAmount,
    userAddress: primaryAddress as Address | undefined,
    enabled: Boolean(primaryAddress),
  });

  const maxWithdrawable = preview?.maxWithdraw ?? 0n;

  const executeWithdraw = () => {
    if (!primaryAddress || parsedAmount <= 0n || parsedAmount > maxWithdrawable) return;

    withdrawMutation.mutate(
      {
        gardenAddress,
        assetAddress: vault.asset,
        vaultAddress: vault.vaultAddress,
        amount: parsedAmount,
        owner: primaryAddress as Address,
        receiver: primaryAddress as Address,
      },
      { onSuccess: () => setAmountInput("") }
    );
  };

  return (
    <div className="rounded-lg border border-stroke-soft bg-bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-strong">{assetSymbol}</p>
        <p className="text-xs text-text-sub">
          {formatMessage({ id: "app.treasury.availableBalance" })}:{" "}
          {formatTokenAmount(maxWithdrawable, assetDecimals)} {assetSymbol}
        </p>
      </div>

      <p className="mb-2 text-xs text-text-soft">
        {formatMessage({ id: "app.treasury.myShares" })}: {formatTokenAmount(deposit.shares, 18)}
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          placeholder={`0.0 ${assetSymbol}`}
          aria-label={formatMessage({ id: "app.treasury.withdrawAmount" })}
          aria-invalid={Boolean(inputError)}
          className={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
            inputError
              ? "border-error-base focus:border-error-base"
              : "border-stroke-sub bg-bg-white focus:border-primary-base"
          }`}
        />
        <button
          type="button"
          onClick={() => setAmountInput(formatUnits(maxWithdrawable, assetDecimals))}
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
          !isOnline ||
          parsedAmount <= 0n ||
          parsedAmount > maxWithdrawable ||
          withdrawMutation.isPending
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
            amount: formatTokenAmount(parsedAmount, assetDecimals),
            asset: assetSymbol,
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
