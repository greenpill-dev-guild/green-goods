import { Card } from "@green-goods/shared/components/Cards/CardBase";
import { Alert } from "@green-goods/shared/components/Alert";
import {
  estimateYieldDistribution,
  useHarvestDistribution,
  useYieldStatus,
} from "@green-goods/shared/hooks";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useEmergencyPause } from "@green-goods/shared/hooks/vault/useEmergencyPause";
import { useEnableAutoAllocate } from "@green-goods/shared/hooks/vault/useEnableAutoAllocate";
import { useVaultPreview } from "@green-goods/shared/hooks/vault/useVaultPreview";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenVault } from "@green-goods/shared/types/vaults";
import { OCTANT_VAULT_ABI } from "@green-goods/shared/utils/blockchain/abis/octant";
import { ZERO_ADDRESS } from "@green-goods/shared/utils/blockchain/address";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import { getBlockExplorerAddressUrl } from "@green-goods/shared/utils/eas/explorers";
import { RiExternalLinkLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useReadContracts } from "wagmi";
import { AdminButton } from "@/components/AdminButton";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { EnsAddressText } from "@/components/EnsAddressText";

interface PositionCardProps {
  gardenAddress: Address;
  vault: GardenVault;
  canManage: boolean;
  canEmergencyPause: boolean;
  isModuleOwner: boolean;
  onDeposit: (assetAddress: Address) => void;
  onWithdraw: (assetAddress: Address) => void;
}

export function PositionCard({
  gardenAddress,
  vault,
  canManage,
  canEmergencyPause,
  isModuleOwner,
  onDeposit,
  onWithdraw,
}: PositionCardProps) {
  const { formatMessage, formatNumber } = useIntl();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();
  const harvestDistribution = useHarvestDistribution();
  const emergencyPause = useEmergencyPause();
  const enableAutoAllocate = useEnableAutoAllocate();
  const [confirmPauseOpen, setConfirmPauseOpen] = useState(false);
  const [confirmDistributionOpen, setConfirmDistributionOpen] = useState(false);

  const assetDecimals = getVaultAssetDecimals(vault.asset, vault.chainId);
  const netDeposited = getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
  const hasDeposits = netDeposited > 0n;
  const assetSymbol = getVaultAssetSymbol(vault.asset, vault.chainId);
  const { preview } = useVaultPreview({
    vaultAddress: vault.vaultAddress,
    userAddress: ZERO_ADDRESS as Address,
    enabled: hasDeposits,
  });
  const totalAssets = preview?.totalAssets ?? netDeposited;
  const unharvestedImpactYield = totalAssets > netDeposited ? totalAssets - netDeposited : 0n;
  const yieldStatus = useYieldStatus(gardenAddress, vault.asset, vault.vaultAddress, {
    enabled: canManage,
  });
  const shouldHarvestFirst = unharvestedImpactYield > 0n;
  const estimatedTotal = yieldStatus.totalAvailable + unharvestedImpactYield;
  const estimatedDistribution = estimateYieldDistribution(estimatedTotal, yieldStatus.splitConfig);

  // On-chain health check: does this vault accept deposits?
  const { preview: depositHealth } = useVaultPreview({
    vaultAddress: vault.vaultAddress,
    userAddress: primaryAddress as Address | undefined,
    enabled: Boolean(primaryAddress),
  });
  const vaultAcceptingDeposits = depositHealth ? depositHealth.maxDeposit > 0n : true;

  // Diagnostic reads: distinguish legacy misconfiguration from shutdown/paused/full
  const { data: diagnosticData, refetch: refetchDiagnostics } = useReadContracts({
    contracts: [
      {
        address: vault.vaultAddress as Address,
        abi: OCTANT_VAULT_ABI,
        functionName: "isShutdown",
        args: [],
      },
      {
        address: vault.vaultAddress as Address,
        abi: OCTANT_VAULT_ABI,
        functionName: "depositLimit",
        args: [],
      },
    ] as const,
    query: { enabled: !vaultAcceptingDeposits && isModuleOwner },
  });
  const isShutdown =
    diagnosticData?.[0]?.status === "success" ? (diagnosticData[0].result as boolean) : false;
  const depositLimitRaw =
    diagnosticData?.[1]?.status === "success" ? (diagnosticData[1].result as bigint) : null;

  // Only show auto-allocation CTA when this is specifically the legacy misconfiguration:
  // not shutdown, and deposit limit is zero (the hallmark of missing auto-allocation wiring)
  const isLegacyMisconfiguration = !vaultAcceptingDeposits && !isShutdown && depositLimitRaw === 0n;

  const runHarvestDistribution = (harvestFirst: boolean) => {
    harvestDistribution.mutate(
      {
        gardenAddress,
        assetAddress: vault.asset,
        vaultAddress: vault.vaultAddress,
        assetSymbol,
        harvestFirst,
        hadPendingYield: yieldStatus.pendingYield > 0n,
        thresholdMetBefore: yieldStatus.status === "ready",
      },
      {
        onSettled: () => {
          setConfirmDistributionOpen(false);
          void yieldStatus.refetch();
        },
      }
    );
  };

  const onConfirmPause = () => {
    emergencyPause.mutate(
      { gardenAddress, assetAddress: vault.asset },
      { onSuccess: () => setConfirmPauseOpen(false) }
    );
  };

  const onEnableAutoAllocate = () => {
    enableAutoAllocate.mutate(
      { gardenAddress, assetAddress: vault.asset },
      {
        onSuccess: () => {
          void refetchDiagnostics();
        },
      }
    );
  };

  const formatAmount = (amount: bigint) =>
    `${formatTokenAmount(amount, assetDecimals)} ${assetSymbol}`;
  const formatPercent = (basisPoints: number) =>
    formatNumber(basisPoints / 10_000, { style: "percent", maximumFractionDigits: 2 });
  const distributionResult = harvestDistribution.data;
  const hasWorkflowOutcome = Boolean(distributionResult);
  const canOpenDistribution =
    !yieldStatus.isLoading &&
    !yieldStatus.isError &&
    yieldStatus.isVaultRegistered &&
    (shouldHarvestFirst || yieldStatus.status === "ready");
  const actionLabelId = shouldHarvestFirst
    ? "app.yield.harvestDistribution.action.harvest"
    : "app.yield.harvestDistribution.action.distribute";
  const confirmationDescription = formatMessage(
    { id: "app.yield.harvestDistribution.confirmDescription" },
    {
      total: formatAmount(estimatedDistribution.totalAmount),
      cookieJarAmount: formatAmount(estimatedDistribution.cookieJarAmount),
      cookieJarPercent: formatPercent(yieldStatus.splitConfig.cookieJarBps),
      destination: formatAddress(yieldStatus.destination.address),
      fractionsAmount: formatAmount(estimatedDistribution.fractionsAmount),
      fractionsPercent: formatPercent(yieldStatus.splitConfig.fractionsBps),
      treasuryAmount: formatAmount(estimatedDistribution.treasuryAmount),
      treasuryPercent: formatPercent(yieldStatus.splitConfig.juiceboxBps),
      promptNote: formatMessage({
        id: shouldHarvestFirst
          ? "app.yield.harvestDistribution.twoPrompts"
          : "app.yield.harvestDistribution.onePrompt",
      }),
    }
  );

  return (
    <Card padding="compact" className="sm:p-5">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-strong sm:text-lg">{assetSymbol}</h3>
          {!vaultAcceptingDeposits && (
            <span className="rounded-full bg-warning-lighter px-2 py-1 text-xs font-medium text-warning-dark">
              {formatMessage({ id: "app.treasury.depositsDisabled" })}
            </span>
          )}
        </div>
        <a
          href={getBlockExplorerAddressUrl(chainId, vault.vaultAddress)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-primary-base hover:underline"
        >
          {formatMessage({ id: "app.explorer.viewVault" })}:{" "}
          <EnsAddressText address={vault.vaultAddress} />
          <RiExternalLinkLine className="h-3 w-3" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.treasury.netDeposited" })}
          </p>
          <p className="mt-1 font-semibold text-text-strong">
            {formatTokenAmount(netDeposited, assetDecimals)} {assetSymbol}
          </p>
        </div>
        <div
          className={`rounded-md border p-3 ${unharvestedImpactYield > 0n ? "border-success-light bg-success-lighter" : "border-stroke-soft bg-bg-weak"}`}
        >
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.treasury.currentYield" })}
          </p>
          <p
            className={`mt-1 font-semibold ${unharvestedImpactYield > 0n ? "text-success-dark" : "text-text-strong"}`}
          >
            {formatTokenAmount(unharvestedImpactYield, assetDecimals)} {assetSymbol}
            {unharvestedImpactYield > 0n && (
              <span className="ml-1 text-xs font-normal">
                {formatMessage({ id: "app.yield.accruing" })}
              </span>
            )}
          </p>
        </div>
        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.treasury.depositorCount" })}
          </p>
          <p className="mt-1 font-semibold text-text-strong">{vault.depositorCount}</p>
        </div>
        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.treasury.harvestCount" })}
          </p>
          <p className="mt-1 font-semibold text-text-strong">{vault.totalHarvestCount}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-text-sub">
        {formatMessage({ id: "app.treasury.impactYieldHelper" })}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <AdminButton
          variant="filled"
          size="sm"
          onClick={() => onDeposit(vault.asset)}
          disabled={!vaultAcceptingDeposits}
          title={
            !vaultAcceptingDeposits
              ? formatMessage({ id: "app.treasury.vaultNotAcceptingDeposits" })
              : undefined
          }
        >
          {formatMessage({ id: "app.treasury.deposit" })}
        </AdminButton>
        <AdminButton variant="outlined" size="sm" onClick={() => onWithdraw(vault.asset)}>
          {formatMessage({ id: "app.treasury.withdraw" })}
        </AdminButton>
      </div>

      {/* Auto-allocation repair — only shown for the specific legacy misconfiguration
           (deposit limit zero + not shutdown), not for paused/full/generic states */}
      {isLegacyMisconfiguration && isModuleOwner && (
        <div className="mt-2">
          <AdminButton
            variant="outlined"
            size="sm"
            className="w-full border-warning-base bg-warning-lighter text-warning-dark hover:bg-warning-light"
            onClick={onEnableAutoAllocate}
            disabled={enableAutoAllocate.isPending}
            loading={enableAutoAllocate.isPending}
          >
            {formatMessage({ id: "app.treasury.enableAutoAllocate" })}
          </AdminButton>
        </div>
      )}

      {canManage && (
        <div className="mt-3 space-y-3">
          {!hasWorkflowOutcome && yieldStatus.status === "waiting" && (
            <Alert variant="info" className="p-3">
              {formatMessage(
                { id: "app.yield.harvestDistribution.waitingDetails" },
                {
                  amount: formatAmount(yieldStatus.totalAvailable),
                  threshold: formatAmount(yieldStatus.threshold),
                }
              )}
            </Alert>
          )}

          {!hasWorkflowOutcome &&
            (yieldStatus.status === "error" || yieldStatus.status === "unavailable") && (
              <Alert variant="error" className="p-3">
                {formatMessage({ id: "app.yield.harvestDistribution.statusUnavailable" })}
              </Alert>
            )}

          {distributionResult?.status === "harvest_submitted" && (
            <Alert variant="info" className="p-3">
              {formatMessage({ id: "app.yield.harvestDistribution.harvestSubmittedDetails" })}
            </Alert>
          )}

          {distributionResult?.status === "distribution_submitted" && (
            <Alert variant="info" className="p-3">
              {formatMessage({ id: "app.yield.harvestDistribution.distributionSubmittedDetails" })}
            </Alert>
          )}

          {distributionResult?.status === "waiting" && (
            <Alert variant="info" className="p-3">
              {formatMessage(
                { id: "app.yield.harvestDistribution.waitingDetails" },
                {
                  amount: formatAmount(distributionResult.availableAmount),
                  threshold: formatAmount(distributionResult.threshold),
                }
              )}
            </Alert>
          )}

          {distributionResult?.status === "distribution_pending" && (
            <Alert
              variant="warning"
              className="p-3"
              action={
                <AdminButton
                  variant="outlined"
                  size="sm"
                  onClick={() => runHarvestDistribution(false)}
                  disabled={harvestDistribution.isPending}
                  loading={harvestDistribution.isPending}
                >
                  {formatMessage({ id: "app.yield.harvestDistribution.action.retry" })}
                </AdminButton>
              }
            >
              {formatMessage({ id: "app.yield.harvestDistribution.pendingDetails" })}
            </Alert>
          )}

          {distributionResult?.status === "distributed" && (
            <Alert variant="success" className="p-3">
              {distributionResult.amounts
                ? formatMessage(
                    { id: "app.yield.harvestDistribution.successDetails" },
                    {
                      cookieJarAmount: formatAmount(distributionResult.amounts.cookieJarAmount),
                      destination: formatAddress(yieldStatus.destination.address),
                      fractionsAmount: formatAmount(distributionResult.amounts.fractionsAmount),
                      treasuryAmount: formatAmount(distributionResult.amounts.treasuryAmount),
                    }
                  )
                : formatMessage({ id: "app.yield.harvestDistribution.successNoAmounts" })}
            </Alert>
          )}

          {!hasWorkflowOutcome && (shouldHarvestFirst || yieldStatus.status === "ready") && (
            <div className="flex justify-end">
              <AdminButton
                variant="filled"
                size="sm"
                onClick={() => setConfirmDistributionOpen(true)}
                disabled={!canOpenDistribution || harvestDistribution.isPending}
                loading={harvestDistribution.isPending}
              >
                {formatMessage({ id: actionLabelId })}
              </AdminButton>
            </div>
          )}

          <div className="flex justify-end border-t border-stroke-soft pt-3">
            <AdminButton
              variant="danger"
              size="sm"
              onClick={() => setConfirmPauseOpen(true)}
              disabled={!canEmergencyPause || emergencyPause.isPending}
              loading={emergencyPause.isPending}
            >
              {formatMessage({ id: "app.treasury.emergencyPause" })}
            </AdminButton>
          </div>
        </div>
      )}

      <AdminConfirmDialog
        isOpen={confirmDistributionOpen}
        onClose={() => setConfirmDistributionOpen(false)}
        onConfirm={() => runHarvestDistribution(shouldHarvestFirst)}
        title={formatMessage({ id: "app.yield.harvestDistribution.confirmTitle" })}
        description={confirmationDescription}
        confirmLabel={formatMessage({ id: actionLabelId })}
        cancelLabel={formatMessage({ id: "app.wizard.cancel" })}
        tone="community"
        isLoading={harvestDistribution.isPending}
      />

      <AdminConfirmDialog
        isOpen={confirmPauseOpen}
        onClose={() => setConfirmPauseOpen(false)}
        onConfirm={onConfirmPause}
        title={formatMessage({ id: "app.treasury.emergencyPauseTitle" })}
        description={formatMessage({ id: "app.treasury.emergencyPauseDescription" })}
        confirmLabel={formatMessage({ id: "app.treasury.emergencyPause" })}
        cancelLabel={formatMessage({ id: "app.wizard.cancel" })}
        variant="danger"
        tone="community"
        isLoading={emergencyPause.isPending}
      />
    </Card>
  );
}
