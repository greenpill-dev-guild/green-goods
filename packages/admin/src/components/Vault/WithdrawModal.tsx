import {
  type Address,
  Alert,
  AssetSelector,
  Button,
  FormField,
  formatTokenAmount,
  type GardenVault,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  TextInput,
  TxInlineFeedback,
  useDebouncedValue,
  useTxErrorMessages,
  useUser,
  useVaultDeposits,
  useVaultPreview,
  useVaultWithdraw,
  validateDecimalInput,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  vaults: GardenVault[];
  defaultAsset?: string;
}

export function WithdrawModal({
  isOpen,
  onClose,
  gardenAddress,
  vaults,
  defaultAsset,
}: WithdrawModalProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const withdrawMutation = useVaultWithdraw({ errorMode: "inline" });
  const resetWithdrawMutation = withdrawMutation.reset;
  const [selectedAsset, setSelectedAsset] = useState<string>(
    defaultAsset ?? vaults[0]?.asset ?? ""
  );
  const [amountInput, setAmountInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(defaultAsset ?? vaults[0]?.asset ?? "");
    setAmountInput("");
    resetWithdrawMutation();
  }, [defaultAsset, isOpen, resetWithdrawMutation, vaults]);

  const selectedVault = useMemo(
    () => vaults.find((vault) => vault.asset.toLowerCase() === selectedAsset.toLowerCase()),
    [selectedAsset, vaults]
  );

  const {
    deposits,
    isError: depositsError,
    error: depositsQueryError,
    refetch: refetchDeposits,
    isFetching: depositsFetching,
  } = useVaultDeposits(gardenAddress, {
    userAddress: primaryAddress ?? undefined,
    enabled: isOpen && Boolean(primaryAddress),
    refetchInterval: isOpen ? 10_000 : false,
  });

  const selectedDeposit = useMemo(
    () => deposits.find((deposit) => deposit.asset.toLowerCase() === selectedAsset.toLowerCase()),
    [deposits, selectedAsset]
  );

  const assetDecimals = getVaultAssetDecimals(selectedAsset, selectedVault?.chainId);
  const assetSymbol = selectedVault
    ? getVaultAssetSymbol(selectedVault.asset, selectedVault.chainId)
    : "";

  const inputError = useMemo(
    () => validateDecimalInput(amountInput, assetDecimals),
    [amountInput, assetDecimals]
  );

  const amount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, assetDecimals);
    } catch {
      return 0n;
    }
  }, [amountInput, inputError, assetDecimals]);

  const debouncedAmount = useDebouncedValue(amount, 300);

  const { preview } = useVaultPreview({
    vaultAddress: selectedVault?.vaultAddress as Address | undefined,
    amount: debouncedAmount,
    userAddress: primaryAddress as Address | undefined,
    enabled: isOpen && Boolean(selectedVault && primaryAddress),
  });

  const maxWithdrawable = preview?.maxWithdraw ?? 0n;
  const maxShares = selectedDeposit?.shares ?? 0n;

  const exceedsBalanceError = useMemo(() => {
    if (!amountInput.trim() || inputError) return null;
    return amount > maxWithdrawable ? "app.treasury.exceedsAvailableBalance" : null;
  }, [amountInput, inputError, amount, maxWithdrawable]);

  const amountError = inputError ?? exceedsBalanceError;
  const txError = useTxErrorMessages(withdrawMutation.error);

  const onSubmit = () => {
    if (!selectedVault || !primaryAddress || amount <= 0n || amountError) return;

    withdrawMutation.mutate(
      {
        gardenAddress,
        assetAddress: selectedVault.asset,
        vaultAddress: selectedVault.vaultAddress,
        amount,
        owner: primaryAddress as Address,
        receiver: primaryAddress as Address,
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={formatMessage({ id: "app.treasury.withdraw" })}
      description={formatMessage({ id: "app.treasury.withdrawDescription" })}
      preventClose={withdrawMutation.isPending}
      actions={
        <>
          <AdminButton
            type="button"
            variant="text"
            onClick={onClose}
            disabled={withdrawMutation.isPending}
          >
            {formatMessage({ id: "app.common.cancel" })}
          </AdminButton>
          <AdminButton
            type="button"
            onClick={onSubmit}
            disabled={
              Boolean(amountError) || amount <= 0n || depositsError || withdrawMutation.isPending
            }
            loading={withdrawMutation.isPending}
          >
            {formatMessage({ id: "app.treasury.withdraw" })}
          </AdminButton>
        </>
      }
    >
      <div className="space-y-4">
        <AssetSelector
          vaults={vaults}
          selectedAsset={selectedAsset}
          onSelect={setSelectedAsset}
          ariaLabel={formatMessage({ id: "app.treasury.asset" })}
          renderBadge={(vault) => {
            const deposit = deposits.find(
              (item) => item.asset.toLowerCase() === vault.asset.toLowerCase()
            );
            if (!deposit || deposit.shares <= 0n) return null;
            return (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-white bg-success-base"
                title={formatMessage({ id: "app.treasury.hasDeposits" })}
              />
            );
          }}
        />
        {depositsError && (
          <Alert
            variant="error"
            action={
              <button
                type="button"
                onClick={() => {
                  void refetchDeposits();
                }}
                disabled={depositsFetching}
                className="rounded-md border border-error-light px-2 py-1 text-xs font-medium text-error-dark hover:bg-error-lighter disabled:cursor-not-allowed disabled:opacity-60"
              >
                {depositsFetching
                  ? formatMessage({ id: "app.common.refreshing" })
                  : formatMessage({ id: "app.common.tryAgain" })}
              </button>
            }
          >
            {depositsQueryError instanceof Error
              ? depositsQueryError.message
              : formatMessage({ id: "app.treasury.errorLoading" })}
          </Alert>
        )}

        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3 text-sm text-text-sub">
          <p>
            {formatMessage({ id: "app.treasury.availableBalance" })}:{" "}
            <span className="font-medium text-text-strong">
              {formatTokenAmount(maxWithdrawable, assetDecimals)} {assetSymbol}
            </span>
          </p>
          <p>
            {formatMessage({ id: "app.treasury.myShares" })}:{" "}
            <span className="font-medium text-text-strong">
              {formatTokenAmount(maxShares, 18)}{" "}
              {formatMessage({ id: "app.treasury.shares", defaultMessage: "shares" })}
            </span>
          </p>
        </div>

        <FormField
          label={formatMessage({ id: "app.treasury.withdrawAmount" })}
          htmlFor="withdraw-amount"
          error={amountError ? formatMessage({ id: amountError }) : undefined}
        >
          <div className="flex items-center gap-2">
            <TextInput
              surface="admin"
              id="withdraw-amount"
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder={`0.0 ${assetSymbol}`}
              aria-required="true"
              aria-invalid={Boolean(amountError)}
              invalid={Boolean(amountError)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAmountInput(formatUnits(maxWithdrawable, assetDecimals))}
            >
              {formatMessage({ id: "app.treasury.max" })}
            </Button>
          </div>
        </FormField>

        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3 text-sm text-text-sub">
          <p>
            {formatMessage({ id: "app.treasury.sharesToBurn" })}:{" "}
            <span className="font-medium text-text-strong">
              {preview && debouncedAmount > 0n
                ? `${formatTokenAmount(preview.previewWithdrawShares, 18)} ${formatMessage({ id: "app.treasury.shares", defaultMessage: "shares" })}`
                : "--"}
            </span>
          </p>
        </div>
        <TxInlineFeedback
          visible={Boolean(withdrawMutation.error)}
          severity={txError.view.severity}
          title={txError.title}
          message={txError.message}
          reserveClassName="min-h-[5.5rem]"
        />
      </div>
    </AdminDialog>
  );
}
