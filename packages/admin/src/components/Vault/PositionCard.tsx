import {
  type Address,
  type GardenVault,
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  isZeroAddressValue,
  ZERO_ADDRESS,
  useEmergencyPause,
  useHarvest,
  useVaultPreview,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiLoader4Line } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

interface PositionCardProps {
  gardenAddress: Address;
  vault: GardenVault;
  canManage: boolean;
  canEmergencyPause: boolean;
  onDeposit: (assetAddress: Address) => void;
  onWithdraw: (assetAddress: Address) => void;
}

export function PositionCard({
  gardenAddress,
  vault,
  canManage,
  canEmergencyPause,
  onDeposit,
  onWithdraw,
}: PositionCardProps) {
  const { formatMessage } = useIntl();
  const harvest = useHarvest();
  const emergencyPause = useEmergencyPause();
  const [confirmPauseOpen, setConfirmPauseOpen] = useState(false);

  const donationConfigured = !isZeroAddressValue(vault.donationAddress);
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
  const currentYield = totalAssets > netDeposited ? totalAssets - netDeposited : 0n;

  const onHarvest = () => {
    if (!donationConfigured) return;
    harvest.mutate({ gardenAddress, assetAddress: vault.asset });
  };

  const onConfirmPause = () => {
    emergencyPause.mutate(
      { gardenAddress, assetAddress: vault.asset },
      { onSuccess: () => setConfirmPauseOpen(false) }
    );
  };

  return (
    <article className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-strong sm:text-lg">{assetSymbol}</h3>
        {vault.paused && (
          <span className="rounded-full bg-error-lighter px-2 py-1 text-xs font-medium text-error-dark">
            {formatMessage({ id: "app.treasury.paused" })}
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
        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.treasury.currentYield" })}
          </p>
          <p className="mt-1 font-semibold text-text-strong">
            {formatTokenAmount(currentYield, assetDecimals)} {assetSymbol}
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onDeposit(vault.asset)}
          className="rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak"
        >
          {formatMessage({ id: "app.treasury.deposit" })}
        </button>
        <button
          type="button"
          onClick={() => onWithdraw(vault.asset)}
          className="rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak"
        >
          {formatMessage({ id: "app.treasury.withdraw" })}
        </button>
      </div>

      {canManage && (
        <div className="mt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onHarvest}
                disabled={!donationConfigured || harvest.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-base px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
              >
                {harvest.isPending && <RiLoader4Line className="h-4 w-4 animate-spin" />}
                {formatMessage({ id: "app.treasury.harvest" })}
              </button>
              {!donationConfigured && (
                <p className="text-xs text-warning-dark">
                  {formatMessage({ id: "app.treasury.setDonationFirst" })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setConfirmPauseOpen(true)}
              disabled={!canEmergencyPause || emergencyPause.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-error-light bg-error-lighter px-3 py-2 text-sm font-medium text-error-dark transition hover:bg-error-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {emergencyPause.isPending && <RiLoader4Line className="h-4 w-4 animate-spin" />}
              {formatMessage({ id: "app.treasury.emergencyPause" })}
            </button>
          </div>
        </div>
      )}

      {/* Emergency pause confirmation dialog */}
      <Dialog.Root open={confirmPauseOpen} onOpenChange={setConfirmPauseOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[10000] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg-white p-6 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-lg font-semibold text-text-strong">
              {formatMessage({ id: "app.treasury.emergencyPauseTitle" })}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-text-sub">
              {formatMessage({ id: "app.treasury.emergencyPauseDescription" })}
            </Dialog.Description>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-stroke-sub bg-bg-white px-4 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak"
                >
                  {formatMessage({ id: "app.wizard.cancel" })}
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={onConfirmPause}
                disabled={emergencyPause.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-error-light bg-error-lighter px-4 py-2 text-sm font-medium text-error-dark transition hover:bg-error-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {emergencyPause.isPending && <RiLoader4Line className="h-4 w-4 animate-spin" />}
                {formatMessage({ id: "app.treasury.emergencyPause" })}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </article>
  );
}
