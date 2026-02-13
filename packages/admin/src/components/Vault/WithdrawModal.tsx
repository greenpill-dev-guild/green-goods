import {
  type Address,
  type GardenVault,
  AssetSelector,
  formatTokenAmount,
  getVaultAssetDecimals,
  validateDecimalInput,
  useUser,
  useVaultDeposits,
  useDebouncedValue,
  useVaultPreview,
  useVaultWithdraw,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
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
  const [sharesInput, setSharesInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(defaultAsset ?? vaults[0]?.asset ?? "");
    setSharesInput("");
  }, [defaultAsset, isOpen, vaults]);

  const selectedVault = useMemo(
    () => vaults.find((vault) => vault.asset.toLowerCase() === selectedAsset.toLowerCase()),
    [selectedAsset, vaults]
  );

  const { deposits } = useVaultDeposits(gardenAddress, {
    userAddress: primaryAddress ?? undefined,
    enabled: isOpen && Boolean(primaryAddress),
  });

  const selectedDeposit = useMemo(
    () => deposits.find((deposit) => deposit.asset.toLowerCase() === selectedAsset.toLowerCase()),
    [deposits, selectedAsset]
  );

  const maxShares = selectedDeposit?.shares ?? 0n;
  const inputError = useMemo(() => validateDecimalInput(sharesInput, 18), [sharesInput]);

  const shares = useMemo(() => {
    if (!sharesInput.trim() || inputError) return 0n;
    try {
      return parseUnits(sharesInput, 18);
    } catch {
      return 0n;
    }
  }, [sharesInput, inputError]);

  const assetDecimals = getVaultAssetDecimals(selectedAsset, selectedVault?.chainId);

  const debouncedShares = useDebouncedValue(shares, 300);

  const { preview } = useVaultPreview({
    vaultAddress: selectedVault?.vaultAddress as Address | undefined,
    shares: debouncedShares,
    userAddress: primaryAddress as Address | undefined,
    enabled: isOpen && Boolean(selectedVault && debouncedShares > 0n),
  });

  const onSubmit = () => {
    if (!selectedVault || !primaryAddress || shares <= 0n) return;

    withdrawMutation.mutate(
      {
        gardenAddress,
        assetAddress: selectedVault.asset,
        vaultAddress: selectedVault.vaultAddress,
        shares,
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
              <button type="button" className="rounded-md p-2 text-text-soft hover:text-text-sub">
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

            <div className="rounded-md border border-stroke-soft bg-bg-weak p-3 text-sm text-text-sub">
              <p>
                {formatMessage({ id: "app.treasury.myShares" })}:{" "}
                <span className="font-medium text-text-strong">
                  {formatTokenAmount(maxShares, 18)}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-sub">
                {formatMessage({ id: "app.treasury.withdrawShares" })}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={sharesInput}
                  onChange={(event) => setSharesInput(event.target.value)}
                  placeholder="0.0"
                  aria-invalid={Boolean(inputError)}
                  className={`w-full rounded-md border px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
                    inputError
                      ? "border-error-base focus:border-error-base"
                      : "border-stroke-sub bg-bg-white focus:border-primary-base"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setSharesInput(formatUnits(maxShares, 18))}
                  className="rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub hover:bg-bg-weak"
                >
                  {formatMessage({ id: "app.treasury.max" })}
                </button>
              </div>
              {inputError && (
                <p className="text-xs text-error-dark" role="alert">
                  {formatMessage({ id: inputError })}
                </p>
              )}
            </div>

            <div className="rounded-md border border-stroke-soft bg-bg-weak p-3 text-sm text-text-sub">
              <p>
                {formatMessage({ id: "app.treasury.estimatedAssets" })}:{" "}
                <span className="font-medium text-text-strong">
                  {preview ? formatTokenAmount(preview.previewAssets, assetDecimals) : "--"}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={
                Boolean(inputError) ||
                shares <= 0n ||
                shares > maxShares ||
                withdrawMutation.isPending
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
            >
              {withdrawMutation.isPending && <RiLoader4Line className="h-4 w-4 animate-spin" />}
              {withdrawMutation.isPending
                ? formatMessage({ id: "app.treasury.withdrawing" })
                : formatMessage({ id: "app.treasury.withdraw" })}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
