import {
  type Address,
  formatTokenAmount,
  type GardenVault,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  OCTANT_VAULT_ABI,
  useEnableAutoAllocate,
  useEmergencyPause,
  useHarvest,
  useUser,
  useVaultPreview,
  ZERO_ADDRESS,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useReadContracts } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const harvest = useHarvest();
  const emergencyPause = useEmergencyPause();
  const enableAutoAllocate = useEnableAutoAllocate();
  const [confirmPauseOpen, setConfirmPauseOpen] = useState(false);

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

  const onHarvest = () => {
    harvest.mutate({ gardenAddress, assetAddress: vault.asset });
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

  return (
    <Card padding="compact" className="sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-strong sm:text-lg">{assetSymbol}</h3>
        {!vaultAcceptingDeposits && (
          <span className="rounded-full bg-warning-lighter px-2 py-1 text-xs font-medium text-warning-dark">
            {formatMessage({ id: "app.treasury.depositsDisabled" })}
          </span>
        )}
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
        <Button
          variant="secondary"
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
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onWithdraw(vault.asset)}>
          {formatMessage({ id: "app.treasury.withdraw" })}
        </Button>
      </div>

      {/* Auto-allocation repair — only shown for the specific legacy misconfiguration
           (deposit limit zero + not shutdown), not for paused/full/generic states */}
      {isLegacyMisconfiguration && isModuleOwner && (
        <div className="mt-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full border-warning-base bg-warning-lighter text-warning-dark hover:bg-warning-light"
            onClick={onEnableAutoAllocate}
            disabled={enableAutoAllocate.isPending}
            loading={enableAutoAllocate.isPending}
          >
            {formatMessage({ id: "app.treasury.enableAutoAllocate" })}
          </Button>
        </div>
      )}

      {canManage && (
        <div className="mt-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              onClick={onHarvest}
              disabled={harvest.isPending}
              loading={harvest.isPending}
            >
              {formatMessage({ id: "app.treasury.harvest" })}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmPauseOpen(true)}
              disabled={!canEmergencyPause || emergencyPause.isPending}
              loading={emergencyPause.isPending}
            >
              {formatMessage({ id: "app.treasury.emergencyPause" })}
            </Button>
          </div>
        </div>
      )}

      {/* Emergency pause confirmation dialog */}
      <Dialog.Root open={confirmPauseOpen} onOpenChange={setConfirmPauseOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[9999] bg-overlay backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[10000] w-full max-w-[calc(100vw-2rem)] sm:max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg-white p-6 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-lg font-semibold text-text-strong">
              {formatMessage({ id: "app.treasury.emergencyPauseTitle" })}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-text-sub">
              {formatMessage({ id: "app.treasury.emergencyPauseDescription" })}
            </Dialog.Description>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="secondary">{formatMessage({ id: "app.wizard.cancel" })}</Button>
              </Dialog.Close>
              <Button
                variant="danger"
                onClick={onConfirmPause}
                disabled={emergencyPause.isPending}
                loading={emergencyPause.isPending}
              >
                {formatMessage({ id: "app.treasury.emergencyPause" })}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}
