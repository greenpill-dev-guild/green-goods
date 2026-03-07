import {
  type Address,
  AssetSelector,
  formatTokenAmount,
  type GardenVault,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  useDebouncedValue,
  useUser,
  useVaultDeposits,
  useVaultPreview,
  useVaultWithdraw,
  validateDecimalInput,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { Button } from "@/components/ui/Button";

const VAULT_DECIMALS_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const VAULT_PREVIEW_WITHDRAW_ABI = [
  {
    type: "function",
    name: "previewWithdraw",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;

function parseAmountToUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const base = 10n ** BigInt(decimals);
  const wholeUnits = BigInt(wholePart || "0") * base;
  const normalizedFraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);
  const fractionUnits = normalizedFraction ? BigInt(normalizedFraction) : 0n;

  return wholeUnits + fractionUnits;
}

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
  const [assetInput, setAssetInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(defaultAsset ?? vaults[0]?.asset ?? "");
    setAssetInput("");
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

  const maxShares = selectedDeposit?.shares ?? 0n;

  const fallbackVaultDecimals = getVaultAssetDecimals(selectedAsset, selectedVault?.chainId);
  const { data: assetDecimalsResult } = useReadContract({
    address: selectedVault?.asset as Address | undefined,
    abi: VAULT_DECIMALS_ABI,
    functionName: "decimals",
    query: {
      enabled: isOpen && Boolean(selectedVault),
    },
  });
  const { data: vaultDecimalsResult } = useReadContract({
    address: selectedVault?.vaultAddress as Address | undefined,
    abi: VAULT_DECIMALS_ABI,
    functionName: "decimals",
    query: {
      enabled: isOpen && Boolean(selectedVault),
    },
  });

  const assetDecimals =
    typeof assetDecimalsResult === "number" ? assetDecimalsResult : fallbackVaultDecimals;
  const shareDecimals =
    typeof vaultDecimalsResult === "number" ? vaultDecimalsResult : fallbackVaultDecimals;
  const assetSymbol = selectedVault
    ? getVaultAssetSymbol(selectedVault.asset, selectedVault.chainId)
    : "";

  const inputError = useMemo(
    () => validateDecimalInput(assetInput, assetDecimals),
    [assetInput, assetDecimals]
  );

  const assetAmount = useMemo(() => {
    if (!assetInput.trim() || inputError) return 0n;
    try {
      return parseAmountToUnits(assetInput, assetDecimals);
    } catch {
      return 0n;
    }
  }, [assetInput, inputError, assetDecimals]);

  const { preview: availablePreview } = useVaultPreview({
    vaultAddress: selectedVault?.vaultAddress as Address | undefined,
    shares: maxShares,
    userAddress: primaryAddress as Address | undefined,
    enabled: isOpen && Boolean(selectedVault && maxShares > 0n),
  });

  const availableAssets = availablePreview?.previewAssets ?? 0n;

  const exceedsBalanceError = useMemo(() => {
    if (!assetInput.trim() || inputError) return null;
    return assetAmount > availableAssets ? "app.treasury.exceedsAvailableBalance" : null;
  }, [assetInput, inputError, assetAmount, availableAssets]);

  const amountError = inputError ?? exceedsBalanceError;

  const debouncedAssetAmount = useDebouncedValue(assetAmount, 300);

  // Withdrawal previews must round up to the required share burn.
  const { data: previewWithdrawShares } = useReadContract({
    address: selectedVault?.vaultAddress as Address | undefined,
    abi: VAULT_PREVIEW_WITHDRAW_ABI,
    functionName: "previewWithdraw",
    args: selectedVault ? [debouncedAssetAmount] : undefined,
    query: {
      enabled: isOpen && Boolean(selectedVault && debouncedAssetAmount > 0n),
    },
  });

  const previewShares = typeof previewWithdrawShares === "bigint" ? previewWithdrawShares : 0n;

  const onSubmit = () => {
    if (
      !selectedVault ||
      !primaryAddress ||
      assetAmount <= 0n ||
      amountError ||
      previewShares <= 0n
    )
      return;

    withdrawMutation.mutate(
      {
        gardenAddress,
        assetAddress: selectedVault.asset,
        vaultAddress: selectedVault.vaultAddress,
        shares: previewShares,
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
                {formatMessage({ id: "app.treasury.myShares" })}:{" "}
                <span className="font-medium text-text-strong">
                  {formatTokenAmount(maxShares, shareDecimals, Math.min(shareDecimals, 6))} shares
                </span>
              </p>
              <p>
                {formatMessage({ id: "app.treasury.availableBalance" })}:{" "}
                <span className="font-medium text-text-strong">
                  {formatTokenAmount(availableAssets, assetDecimals, Math.min(assetDecimals, 6))}{" "}
                  {assetSymbol}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="withdraw-amount" className="text-sm font-medium text-text-sub">
                {formatMessage({ id: "app.treasury.amount" })} ({assetSymbol})
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="withdraw-amount"
                  type="text"
                  inputMode="decimal"
                  value={assetInput}
                  onChange={(event) => setAssetInput(event.target.value)}
                  placeholder="0.0"
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
                  onClick={() => setAssetInput(formatUnits(availableAssets, assetDecimals))}
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
                {formatMessage({ id: "app.treasury.estimatedSharesBurned" })}:{" "}
                <span className="font-medium text-text-strong">
                  {assetAmount > 0n
                    ? `${formatTokenAmount(
                        previewShares,
                        shareDecimals,
                        Math.min(shareDecimals, 6)
                      )} shares`
                    : "--"}
                </span>
              </p>
            </div>

            <Button
              className="w-full"
              onClick={onSubmit}
              disabled={
                Boolean(amountError) ||
                assetAmount <= 0n ||
                previewShares <= 0n ||
                depositsError ||
                withdrawMutation.isPending
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
