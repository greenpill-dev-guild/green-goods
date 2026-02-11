import {
  type Address,
  type GardenVault,
  AssetSelector,
  formatTokenAmount,
  getVaultAssetDecimals,
  validateDecimalInput,
  useUser,
  useDebouncedValue,
  useVaultDeposit,
  useVaultPreview,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiLoader4Line } from "@remixicon/react";
import { useBalance } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  vaults: GardenVault[];
  defaultAsset?: string;
}

export function DepositModal({
  isOpen,
  onClose,
  gardenAddress,
  vaults,
  defaultAsset,
}: DepositModalProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const depositMutation = useVaultDeposit();
  const [selectedAsset, setSelectedAsset] = useState<string>(
    defaultAsset ?? vaults[0]?.asset ?? ""
  );
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(defaultAsset ?? vaults[0]?.asset ?? "");
    setAmount("");
  }, [defaultAsset, isOpen, vaults]);

  const selectedVault = useMemo(
    () => vaults.find((vault) => vault.asset.toLowerCase() === selectedAsset.toLowerCase()),
    [selectedAsset, vaults]
  );

  const { data: balance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedVault?.asset as Address | undefined,
    query: { enabled: isOpen && Boolean(primaryAddress && selectedVault) },
  });

  const decimals =
    balance?.decimals ?? getVaultAssetDecimals(selectedAsset, selectedVault?.chainId);
  const inputError = useMemo(() => validateDecimalInput(amount, decimals), [amount, decimals]);

  const amountBigInt = useMemo(() => {
    if (!amount.trim() || inputError) return 0n;
    try {
      return parseUnits(amount, decimals);
    } catch {
      return 0n;
    }
  }, [amount, decimals, inputError]);

  const debouncedAmount = useDebouncedValue(amountBigInt, 300);

  const { preview } = useVaultPreview({
    vaultAddress: selectedVault?.vaultAddress as Address | undefined,
    amount: debouncedAmount,
    userAddress: primaryAddress as Address | undefined,
    enabled: isOpen && Boolean(selectedVault && debouncedAmount > 0n),
  });

  const onSubmit = () => {
    if (!selectedVault || !primaryAddress || amountBigInt <= 0n) return;

    depositMutation.mutate(
      {
        gardenAddress,
        assetAddress: selectedVault.asset,
        vaultAddress: selectedVault.vaultAddress,
        amount: amountBigInt,
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
                {formatMessage({ id: "app.treasury.deposit" })}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-text-sub">
                {formatMessage({ id: "app.treasury.depositDescription" })}
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
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-sub">
                {formatMessage({ id: "app.treasury.depositAmount" })}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
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
                  onClick={() => {
                    if (!balance) return;
                    setAmount(formatUnits(balance.value, balance.decimals));
                  }}
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
              <p className="text-xs text-text-soft">
                {formatMessage({ id: "app.treasury.walletBalance" })}:{" "}
                {balance
                  ? `${formatTokenAmount(balance.value, balance.decimals)} ${balance.symbol}`
                  : "--"}
              </p>
            </div>

            <div className="rounded-md border border-stroke-soft bg-bg-weak p-3 text-sm text-text-sub">
              <p>
                {formatMessage({ id: "app.treasury.estimatedShares" })}:{" "}
                <span className="font-medium text-text-strong">
                  {preview ? formatTokenAmount(preview.previewShares, 18) : "--"}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={
                !selectedVault ||
                !primaryAddress ||
                amountBigInt <= 0n ||
                amountBigInt > (balance?.value ?? 0n) ||
                depositMutation.isPending
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
            >
              {depositMutation.isPending && <RiLoader4Line className="h-4 w-4 animate-spin" />}
              {depositMutation.isPending
                ? formatMessage({ id: "app.treasury.depositing" })
                : formatMessage({ id: "app.treasury.deposit" })}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
