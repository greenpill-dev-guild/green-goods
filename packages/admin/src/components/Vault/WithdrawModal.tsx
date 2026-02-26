import {
  type Address,
  type GardenVault,
  AssetSelector,
  formatTokenAmount,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  validateDecimalInput,
  useUser,
  useVaultDeposits,
  useDebouncedValue,
  useVaultPreview,
  useVaultWithdraw,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";
import { formatUnits, parseUnits } from "viem";

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
  const withdrawMutation = useVaultWithdraw();
  const [selectedAsset, setSelectedAsset] = useState<string>(
    defaultAsset ?? vaults[0]?.asset ?? ""
  );
  const [amountInput, setAmountInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(defaultAsset ?? vaults[0]?.asset ?? "");
    setAmountInput("");
  }, [defaultAsset, isOpen, vaults]);

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
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[10000] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg-white p-6 shadow-2xl focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold text-text-strong">
                {formatMessage({ id: "app.treasury.withdraw" })}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-text-sub">
                {formatMessage({ id: "app.treasury.withdrawDescription" })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-md p-2 text-text-soft hover:text-text-sub"
                aria-label={formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

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
              <div
                role="alert"
                className="rounded-md border border-error-light bg-error-lighter px-3 py-2 text-xs text-error-dark"
              >
                <p>
                  {depositsQueryError instanceof Error
                    ? depositsQueryError.message
                    : formatMessage({ id: "app.treasury.errorLoading" })}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void refetchDeposits();
                  }}
                  disabled={depositsFetching}
                  className="mt-2 rounded-md border border-error-light px-2 py-1 text-xs font-medium text-error-dark hover:bg-error-lighter disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {depositsFetching
                    ? formatMessage({ id: "app.common.refreshing" })
                    : formatMessage({ id: "app.common.tryAgain" })}
                </button>
              </div>
            )}

            <div className="rounded-md border border-stroke-soft bg-bg-weak p-3 text-sm text-text-sub">
              <p>
                {formatMessage({ id: "app.treasury.availableBalance" })}:{" "}
                <span className="font-medium text-text-strong">
                  {formatTokenAmount(maxWithdrawable, assetDecimals, 6, undefined, true)}{" "}
                  {assetSymbol}
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

            <div className="space-y-2">
              <label htmlFor="withdraw-amount" className="text-sm font-medium text-text-sub">
                {formatMessage({ id: "app.treasury.withdrawAmount" })}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="withdraw-amount"
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  placeholder={`0.0 ${assetSymbol}`}
                  aria-required="true"
                  aria-invalid={Boolean(amountError)}
                  aria-describedby={amountError ? "withdraw-error" : undefined}
                  className={`w-full rounded-md border px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                    amountError
                      ? "border-error-base focus:border-error-base"
                      : "border-stroke-sub bg-bg-white focus:border-primary-base"
                  }`}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAmountInput(formatUnits(maxWithdrawable, assetDecimals))}
                >
                  {formatMessage({ id: "app.treasury.max" })}
                </Button>
              </div>
              {amountError && (
                <p id="withdraw-error" className="text-xs text-error-dark" role="alert">
                  {formatMessage({ id: amountError })}
                </p>
              )}
            </div>

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

            <Button
              className="w-full"
              onClick={onSubmit}
              disabled={
                Boolean(amountError) || amount <= 0n || depositsError || withdrawMutation.isPending
              }
              loading={withdrawMutation.isPending}
            >
              {withdrawMutation.isPending
                ? formatMessage({ id: "app.treasury.withdrawing" })
                : formatMessage({ id: "app.treasury.withdraw" })}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
