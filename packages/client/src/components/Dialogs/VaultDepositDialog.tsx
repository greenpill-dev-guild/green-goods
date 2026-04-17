import {
  type Address,
  Button,
  classifyTxError,
  DialogShell,
  FormField,
  formatTokenAmount,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  isMeaningfulTxErrorMessage,
  TxInlineFeedback,
  useDepositForm,
  useGardenVaults,
  useUser,
  useVaultDeposit,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { useBalance } from "wagmi";

interface VaultDepositDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  gardenName: string;
}

export function VaultDepositDialog({
  isOpen,
  onClose,
  gardenAddress,
  gardenName,
}: VaultDepositDialogProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { vaults } = useGardenVaults(gardenAddress, { enabled: isOpen });
  const depositMutation = useVaultDeposit({ errorMode: "inline" });
  const [selectedAsset, setSelectedAsset] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(vaults[0]?.asset ?? "");
    depositMutation.reset();
  }, [isOpen, vaults, depositMutation.reset]);

  const selectedVault = vaults.find((v) => v.asset.toLowerCase() === selectedAsset.toLowerCase());
  const assetSymbol = selectedVault
    ? getVaultAssetSymbol(selectedVault.asset, selectedVault.chainId)
    : "";

  const { data: balance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedVault?.asset as Address | undefined,
    chainId: selectedVault?.chainId,
    query: { enabled: isOpen && Boolean(primaryAddress && selectedVault) },
  });

  const decimals =
    balance?.decimals ?? getVaultAssetDecimals(selectedAsset, selectedVault?.chainId);
  const { form, amount, amountBigInt, amountErrorKey, hasBlockingError, resetAmount } =
    useDepositForm({ decimals, balance: balance?.value });
  const amountField = form.register("amount");

  useEffect(() => {
    if (!isOpen) resetAmount();
  }, [isOpen, resetAmount]);

  const txErrorView = useMemo(
    () => classifyTxError(depositMutation.error),
    [depositMutation.error]
  );
  const txErrorTitle = formatMessage({
    id: txErrorView.titleKey,
    defaultMessage:
      txErrorView.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
  });
  const txErrorMessage = isMeaningfulTxErrorMessage(txErrorView.rawMessage)
    ? txErrorView.rawMessage
    : formatMessage({
        id: txErrorView.messageKey,
        defaultMessage: "Something went wrong. Please try again.",
      });

  const handleSubmit = () => {
    if (!selectedVault || !primaryAddress || amountBigInt <= 0n || hasBlockingError) return;
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
    <DialogShell
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="md"
      title={formatMessage(
        { id: "public.fund.depositTitle", defaultMessage: "Fund {garden}" },
        { garden: gardenName }
      )}
      description={formatMessage({
        id: "public.fund.depositDescription",
        defaultMessage: "Deposit into this garden's yield-bearing vault.",
      })}
      preventClose={depositMutation.isPending}
    >
      {!primaryAddress ? (
        <p className="py-6 text-center text-sm text-text-sub">
          {formatMessage({
            id: "public.fund.connectToDeposit",
            defaultMessage: "Connect your wallet to deposit.",
          })}
        </p>
      ) : vaults.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-sub">
          {formatMessage({
            id: "public.fund.noVaults",
            defaultMessage: "This garden doesn't have an active vault yet.",
          })}
        </p>
      ) : (
        <div className="space-y-4">
          {vaults.length > 1 && (
            <FormField
              label={formatMessage({ id: "app.treasury.asset", defaultMessage: "Asset" })}
              htmlFor="vault-asset"
            >
              <select
                id="vault-asset"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/40"
              >
                {vaults.map((v) => (
                  <option key={v.asset} value={v.asset}>
                    {getVaultAssetSymbol(v.asset, v.chainId)}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField
            label={formatMessage({
              id: "app.treasury.depositAmount",
              defaultMessage: "Amount",
            })}
            htmlFor="vault-deposit-amount"
            error={amountErrorKey ? formatMessage({ id: amountErrorKey }) : undefined}
            hint={`${formatMessage({ id: "app.treasury.walletBalance", defaultMessage: "Wallet balance" })}: ${
              balance
                ? `${formatTokenAmount(balance.value, balance.decimals)} ${balance.symbol}`
                : "--"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                id="vault-deposit-amount"
                type="text"
                inputMode="decimal"
                {...amountField}
                value={amount}
                placeholder="0.0"
                disabled={depositMutation.isPending}
                aria-invalid={Boolean(amountErrorKey)}
                className={`w-full rounded-md border px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/40 ${
                  amountErrorKey
                    ? "border-error-base focus:border-error-base"
                    : "border-stroke-sub bg-bg-white focus:border-primary-base"
                }`}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!balance) return;
                  form.setValue("amount", formatUnits(balance.value, balance.decimals), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                disabled={!balance || depositMutation.isPending}
              >
                {formatMessage({ id: "app.treasury.max", defaultMessage: "Max" })}
              </Button>
            </div>
          </FormField>

          <TxInlineFeedback
            visible={Boolean(depositMutation.error)}
            severity={txErrorView.severity}
            title={txErrorTitle}
            message={txErrorMessage}
            reserveClassName="min-h-[5.5rem]"
          />

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={
              !selectedVault || amountBigInt <= 0n || hasBlockingError || depositMutation.isPending
            }
            loading={depositMutation.isPending}
          >
            {depositMutation.isPending
              ? formatMessage({ id: "app.treasury.depositing", defaultMessage: "Depositing..." })
              : formatMessage(
                  { id: "public.fund.depositAmount", defaultMessage: "Deposit {asset}" },
                  { asset: assetSymbol }
                )}
          </Button>
        </div>
      )}
    </DialogShell>
  );
}
