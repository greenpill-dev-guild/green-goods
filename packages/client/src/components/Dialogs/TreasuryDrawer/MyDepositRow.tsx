import {
  FormattedAmountInput,
  useFormattedAmountInput,
} from "@green-goods/shared/components/Form/FormattedAmountInput";
import type { Address } from "@green-goods/shared/types/domain";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import {
  formatTokenAmount,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import type { GardenVault, VaultDeposit } from "@green-goods/shared/types/vaults";
import { useDebouncedValue } from "@green-goods/shared/hooks/utils/useDebouncedValue";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useVaultPreview } from "@green-goods/shared/hooks/vault/useVaultPreview";
import { useVaultWithdraw } from "@green-goods/shared/hooks/vault/useVaultWithdraw";
import { RiLoader4Line } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";

export interface MyDepositRowProps {
  deposit: VaultDeposit;
  vault: GardenVault;
  gardenAddress: Address;
}

export function MyDepositRow({ deposit, vault, gardenAddress }: MyDepositRowProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const isOnline = useOnlineStatus();
  const withdrawMutation = useVaultWithdraw();
  const [amountInput, setAmountInput] = useState("");
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const assetDecimals = getVaultAssetDecimals(vault.asset, vault.chainId);
  const assetSymbol = getVaultAssetSymbol(vault.asset, vault.chainId);
  const { parsedAmount: amount, formatErrorId: inputError } = useFormattedAmountInput(
    amountInput,
    assetDecimals
  );
  const parsedAmount = amount ?? 0n;

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

      <FormattedAmountInput
        value={amountInput}
        onValueChange={setAmountInput}
        placeholder={`0.0 ${assetSymbol}`}
        aria-label={formatMessage({ id: "app.treasury.withdrawAmount" })}
        error={inputError ? formatMessage({ id: inputError }) : undefined}
        inputClassName={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
          inputError
            ? "border-error-base focus:border-error-base"
            : "border-stroke-sub-300 bg-bg-white-0 focus:border-primary-base"
        }`}
        errorClassName="mt-1 text-xs text-error-dark"
        endSlot={
          <button
            type="button"
            onClick={() => setAmountInput(formatUnits(maxWithdrawable, assetDecimals))}
            className="min-h-11 min-w-11 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-xs font-medium text-text-sub-600 hover:bg-bg-weak-50"
          >
            {formatMessage({ id: "app.treasury.max" })}
          </button>
        }
      />

      <button
        type="button"
        onClick={() => setShowWithdrawConfirm(true)}
        disabled={
          !isOnline ||
          parsedAmount <= 0n ||
          parsedAmount > maxWithdrawable ||
          withdrawMutation.isPending
        }
        aria-busy={withdrawMutation.isPending || undefined}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2 text-sm font-medium text-text-sub-600 transition hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {withdrawMutation.isPending && (
          <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
        )}
        {formatMessage({ id: "app.treasury.withdraw" })}
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
