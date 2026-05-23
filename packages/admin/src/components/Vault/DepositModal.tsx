import {
  type Address,
  AssetSelector,
  Button,
  FormField,
  formatTokenAmount,
  type GardenVault,
  getDepositLimitLabel,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  hasVaultAssetDecimals,
  TextInput,
  TxInlineFeedback,
  useDebouncedValue,
  useDepositForm,
  useTxErrorMessages,
  useUser,
  useVaultDeposit,
  useVaultPreview,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { encodeFunctionData, formatUnits } from "viem";
import { useBalance, useEstimateGas, useGasPrice } from "wagmi";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { ConnectButton } from "@/components/ConnectButton";

const VAULT_DEPOSIT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;

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
  const depositMutation = useVaultDeposit({ errorMode: "inline" });
  const resetDepositMutation = depositMutation.reset;
  const [selectedAsset, setSelectedAsset] = useState<string>(
    defaultAsset ?? vaults[0]?.asset ?? ""
  );

  const selectedVault = vaults.find((v) => v.asset.toLowerCase() === selectedAsset.toLowerCase());
  const assetSymbol = selectedVault
    ? getVaultAssetSymbol(selectedVault.asset, selectedVault.chainId)
    : "";

  const { data: balance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedVault?.asset as Address | undefined,
    chainId: selectedVault?.chainId,
    query: {
      enabled: isOpen && Boolean(primaryAddress && selectedVault),
      refetchInterval: isOpen ? 10_000 : false,
    },
  });

  const hasStaticDecimals = selectedVault
    ? hasVaultAssetDecimals(selectedVault.asset, selectedVault.chainId)
    : false;
  const fallbackDecimals = getVaultAssetDecimals(selectedAsset, selectedVault?.chainId);
  const decimals = balance?.decimals ?? fallbackDecimals;
  const decimalsReady = typeof balance?.decimals === "number" || hasStaticDecimals;
  const { form, amount, amountBigInt, amountErrorKey, hasBlockingError, resetAmount } =
    useDepositForm({
      decimals,
      balance: balance?.value,
    });
  const amountError = amountErrorKey;
  const amountField = form.register("amount");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(defaultAsset ?? vaults[0]?.asset ?? "");
    resetAmount();
    resetDepositMutation();
  }, [defaultAsset, isOpen, resetAmount, resetDepositMutation, vaults]);

  const debouncedAmount = useDebouncedValue(amountBigInt, 300);

  // Health check: always read maxDeposit when modal is open (independent of amount)
  const { preview: healthCheck } = useVaultPreview({
    vaultAddress: selectedVault?.vaultAddress as Address | undefined,
    userAddress: primaryAddress as Address | undefined,
    chainId: selectedVault?.chainId,
    enabled: isOpen && Boolean(selectedVault),
  });
  const vaultAcceptingDeposits = healthCheck ? healthCheck.maxDeposit > 0n : true;

  // Amount-dependent preview for estimated shares
  const { preview } = useVaultPreview({
    vaultAddress: selectedVault?.vaultAddress as Address | undefined,
    amount: debouncedAmount,
    userAddress: primaryAddress as Address | undefined,
    chainId: selectedVault?.chainId,
    enabled: isOpen && Boolean(selectedVault && debouncedAmount > 0n),
  });

  const depositData = useMemo(() => {
    if (!selectedVault || !primaryAddress || amountBigInt <= 0n || hasBlockingError) {
      return undefined;
    }

    return encodeFunctionData({
      abi: VAULT_DEPOSIT_ABI,
      functionName: "deposit",
      args: [amountBigInt, primaryAddress as Address],
    });
  }, [amountBigInt, hasBlockingError, primaryAddress, selectedVault]);

  const { data: estimatedGas } = useEstimateGas({
    to: selectedVault?.vaultAddress as Address | undefined,
    data: depositData,
    chainId: selectedVault?.chainId,
    query: { enabled: isOpen && Boolean(selectedVault && depositData) },
  });
  const { data: gasPrice } = useGasPrice({
    chainId: selectedVault?.chainId,
    query: { enabled: isOpen && Boolean(estimatedGas) },
  });
  const estimatedGasCost = estimatedGas && gasPrice ? estimatedGas * gasPrice : undefined;
  const txError = useTxErrorMessages(depositMutation.error);
  const depositLimitLabel =
    healthCheck?.maxDeposit && healthCheck.maxDeposit > 0n
      ? getDepositLimitLabel(healthCheck.maxDeposit, {
          assetSymbol,
          decimals,
          unlimitedLabel: formatMessage({
            id: "app.treasury.unlimited",
            defaultMessage: "Unlimited",
          }),
        })
      : null;

  const onSubmit = () => {
    if (!vaultAcceptingDeposits) return;
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
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={formatMessage({ id: "app.treasury.deposit" })}
      description={formatMessage({ id: "app.treasury.depositDescription" })}
      preventClose={depositMutation.isPending}
      actions={
        primaryAddress ? (
          <>
            <AdminButton
              type="button"
              variant="text"
              onClick={onClose}
              disabled={depositMutation.isPending}
            >
              {formatMessage({ id: "app.common.cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              onClick={onSubmit}
              disabled={
                !selectedVault ||
                !primaryAddress ||
                amountBigInt <= 0n ||
                hasBlockingError ||
                !decimalsReady ||
                !vaultAcceptingDeposits ||
                depositMutation.isPending
              }
              loading={depositMutation.isPending}
            >
              {depositMutation.isPending
                ? formatMessage({ id: "app.treasury.depositing" })
                : formatMessage({ id: "app.treasury.deposit" })}
            </AdminButton>
          </>
        ) : null
      }
    >
      {!primaryAddress ? (
        <div className="space-y-4 py-6 text-center">
          <p className="text-sm text-text-sub">
            {formatMessage({ id: "app.treasury.connectToDeposit" })}
          </p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-information-light bg-information-lighter/50 p-3 text-xs text-text-sub">
            <p>
              {formatMessage({
                id: "app.treasury.deposit.guidance",
                defaultMessage:
                  "Deposits earn yield through Aave lending. Yield is automatically split between gardener rewards, impact certificates, and protocol sustainability.",
              })}
            </p>
            <p className="mt-1">
              {formatMessage(
                {
                  id: "app.treasury.deposit.networkHint",
                  defaultMessage: "You need {asset} tokens on Arbitrum to deposit.",
                },
                { asset: assetSymbol || "ERC-20" }
              )}
            </p>
          </div>

          <AssetSelector
            vaults={vaults}
            selectedAsset={selectedAsset}
            onSelect={setSelectedAsset}
            ariaLabel={formatMessage({ id: "app.treasury.asset" })}
          />

          <FormField
            label={formatMessage({ id: "app.treasury.depositAmount" })}
            htmlFor="deposit-amount"
            error={amountError ? formatMessage({ id: amountError }) : undefined}
            hint={`${formatMessage({ id: "app.treasury.walletBalance" })}: ${
              balance
                ? `${formatTokenAmount(balance.value, balance.decimals)} ${balance.symbol}`
                : "--"
            }`}
          >
            <div className="flex items-center gap-2">
              <TextInput
                surface="admin"
                id="deposit-amount"
                type="text"
                inputMode="decimal"
                {...amountField}
                value={amount}
                onChange={(event) => amountField.onChange(event)}
                placeholder="0.0"
                disabled={!decimalsReady || depositMutation.isPending}
                aria-required="true"
                aria-invalid={Boolean(amountError)}
                invalid={Boolean(amountError)}
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
                disabled={!decimalsReady || depositMutation.isPending}
              >
                {formatMessage({ id: "app.treasury.max" })}
              </Button>
            </div>
            {!decimalsReady && selectedVault && (
              <p className="text-xs text-warning-base" role="alert">
                {formatMessage({
                  id: "app.treasury.decimalsUnavailable",
                  defaultMessage: "Token metadata is still loading. Try again in a moment.",
                })}
              </p>
            )}
          </FormField>

          <p className="text-xs text-text-soft">
            {formatMessage({
              id: "app.treasury.deposit.minimumHint",
              defaultMessage: "Minimum deposit: any amount. Deposits can be withdrawn at any time.",
            })}
          </p>

          <div className="rounded-md border border-stroke-soft bg-bg-weak p-3 text-sm text-text-sub">
            <p>
              {formatMessage({ id: "app.treasury.estimatedShares" })}:{" "}
              <span className="font-medium text-text-strong">
                {preview ? `${formatTokenAmount(preview.previewShares, 18)} shares` : "--"}
              </span>
            </p>
            <p>
              {formatMessage({ id: "app.treasury.estimatedGas" })}:{" "}
              <span className="font-medium text-text-strong">
                {estimatedGasCost ? `~${formatUnits(estimatedGasCost, 18)} ETH` : "--"}
              </span>
            </p>
            {assetSymbol && (
              <p>
                {formatMessage({ id: "app.treasury.amountDenomination" })}:{" "}
                <span className="font-medium text-text-strong">{assetSymbol}</span>
              </p>
            )}
          </div>

          {healthCheck && selectedVault && (
            <div className="rounded-md border border-stroke-soft bg-bg-weak p-3 text-sm text-text-sub">
              <p>
                {formatMessage({ id: "app.treasury.totalVaultAssets" })}:{" "}
                <span className="font-medium text-text-strong">
                  {formatTokenAmount(healthCheck.totalAssets, decimals)} {assetSymbol}
                </span>
              </p>
              {healthCheck.maxDeposit > 0n && (
                <p>
                  {formatMessage({ id: "app.treasury.depositLimit" })}:{" "}
                  <span className="font-medium text-text-strong">{depositLimitLabel}</span>
                </p>
              )}
            </div>
          )}

          {!vaultAcceptingDeposits && (
            <p className="text-xs text-error-dark" role="alert">
              {formatMessage({ id: "app.treasury.vaultNotAcceptingDeposits" })}
            </p>
          )}
          <TxInlineFeedback
            visible={Boolean(depositMutation.error)}
            severity={txError.view.severity}
            title={txError.title}
            message={txError.message}
            reserveClassName="min-h-[5.5rem]"
          />
        </div>
      )}
    </AdminDialog>
  );
}
