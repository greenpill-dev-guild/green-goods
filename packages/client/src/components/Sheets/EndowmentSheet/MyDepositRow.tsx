import { Button } from "@green-goods/shared/components/Button";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { Address } from "@green-goods/shared/types/domain";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import {
  formatTokenAmount,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import type { GardenVault, VaultDeposit } from "@green-goods/shared/types/vaults";
import { useDebouncedValue } from "@green-goods/shared/hooks/utils/useDebouncedValue";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useVaultPreview } from "@green-goods/shared/hooks/vault/useVaultPreview";
import { useVaultWithdraw } from "@green-goods/shared/hooks/vault/useVaultWithdraw";
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
    <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-strong-950">{assetSymbol}</p>
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.treasury.availableBalance" })}:{" "}
          {formatTokenAmount(maxWithdrawable, assetDecimals)} {assetSymbol}
        </p>
      </div>

      <p className="mb-2 text-xs text-text-soft-400">
        {formatMessage({ id: "app.treasury.myShares" })}: {formatTokenAmount(deposit.shares, 18)}
      </p>

      <div className="flex items-center gap-2">
        <TextInput
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          placeholder={`0.0 ${assetSymbol}`}
          aria-label={formatMessage({ id: "app.treasury.withdrawAmount" })}
          aria-invalid={Boolean(inputError)}
          invalid={Boolean(inputError)}
        />
        <Button
          type="button"
          emphasis="secondary"
          onClick={() => setAmountInput(formatUnits(maxWithdrawable, assetDecimals))}
        >
          {formatMessage({ id: "app.treasury.max" })}
        </Button>
      </div>
      {inputError && (
        <p className="mt-1 text-xs text-error-dark" role="alert">
          {formatMessage({ id: inputError })}
        </p>
      )}

      <Button
        type="button"
        emphasis="secondary"
        onClick={() => setShowWithdrawConfirm(true)}
        loading={withdrawMutation.isPending}
        disabled={
          !withdrawMutation.isPending &&
          (!isOnline || parsedAmount <= 0n || parsedAmount > maxWithdrawable)
        }
        className="mt-2 w-full"
      >
        {formatMessage({ id: "app.treasury.withdraw" })}
      </Button>

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
