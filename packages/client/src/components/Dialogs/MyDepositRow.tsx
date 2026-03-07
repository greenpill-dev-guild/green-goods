import {
  type Address,
  type GardenVault,
  type VaultDeposit,
  ConfirmDialog,
  formatTokenAmount,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  validateDecimalInput,
  useDebouncedValue,
  useOffline,
  useUser,
  useVaultPreview,
  useVaultWithdraw,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";

interface MyDepositRowProps {
  deposit: VaultDeposit;
  vault: GardenVault;
  gardenAddress: Address;
}

export function MyDepositRow({ deposit, vault, gardenAddress }: MyDepositRowProps) {
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

  function executeWithdraw(): void {
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
  }

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
