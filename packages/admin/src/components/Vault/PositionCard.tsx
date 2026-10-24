import { Alert } from "@green-goods/shared/components/Alert";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useEmergencyPause } from "@green-goods/shared/hooks/vault/useEmergencyPause";
import { useEnableAutoAllocate } from "@green-goods/shared/hooks/vault/useEnableAutoAllocate";
import { useVaultPreview } from "@green-goods/shared/hooks/vault/useVaultPreview";
import { useHarvestDistribution } from "@green-goods/shared/hooks/yield/useHarvestDistribution";
import {
  estimateYieldDistribution,
  useYieldStatus,
} from "@green-goods/shared/hooks/yield/useYieldStatus";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenVault } from "@green-goods/shared/types/vaults";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { OCTANT_VAULT_ABI } from "@green-goods/shared/utils/blockchain/abis/octant";
import { ZERO_ADDRESS } from "@green-goods/shared/utils/blockchain/address";
import {
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import { getBlockExplorerAddressUrl } from "@green-goods/shared/utils/eas/explorers";
import { RiBankLine, RiExternalLinkLine } from "@remixicon/react";
import { useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";
import { useReadContracts } from "wagmi";
import { AdminButton } from "@/components/AdminButton";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { EnsAddressText } from "@/components/EnsAddressText";
import { HarvestOutcomeAlerts } from "./HarvestOutcomeAlerts";

interface PositionCardProps {
  gardenAddress: Address;
  vault: GardenVault;
  canManage: boolean;
  canEmergencyPause: boolean;
  isModuleOwner: boolean;
  onDeposit: (assetAddress: Address) => void;
  onWithdraw: (assetAddress: Address) => void;
}

/**
 * A garden's endowment position on the shared item row: the asset, its depositors and its
 * net deposits on the right, with a pill only when deposits are off, and no action on the row.
 * The row opens the position's page beneath it: the vault's contract, its yield and harvests,
 * Deposit and Withdraw, and a steward's harvest and pause. The page stays mounted while it is
 * closed, so a harvest or pause in flight keeps its state and its outcome.
 */
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
  const pageId = useId();
  const [pageOpen, setPageOpen] = useState(false);
  const harvestDistribution = useHarvestDistribution();
  const emergencyPause = useEmergencyPause();
  const enableAutoAllocate = useEnableAutoAllocate();
  const [confirmPauseOpen, setConfirmPauseOpen] = useState(false);
  const [confirmDistributionOpen, setConfirmDistributionOpen] = useState(false);
  const [confirmRefreshing, setConfirmRefreshing] = useState(false);
  // "auto" re-derives harvest-vs-split from live yield state on every render,
  // so the stage follows the state refreshed while the confirmation is open.
  // The retry entry points pin an explicit stage instead.
  const [confirmMode, setConfirmMode] = useState<"auto" | "split_only" | "harvest_first">("auto");

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
  // The vault-wide delta (totalAssets - netDeposited) still contains the
  // assets backing already-registered resolver shares, which totalAvailable
  // counts too. Only the unregistered remainder is genuinely unharvested.
  const unregisteredVaultYield =
    unharvestedImpactYield > yieldStatus.registeredShareAssets
      ? unharvestedImpactYield - yieldStatus.registeredShareAssets
      : 0n;
  const shouldHarvestFirst = unregisteredVaultYield > 0n;
  const estimatedTotal = yieldStatus.totalAvailable + unregisteredVaultYield;
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

  // Split ratios and destinations can change on-chain while the card stays
  // mounted; refresh the execution-relevant reads whenever the confirmation
  // opens so the operator approves current values, not cached ones. Every
  // workflow entry point — first run and retries alike — goes through here.
  const openDistributionConfirm = (mode: "auto" | "split_only" | "harvest_first") => {
    setConfirmMode(mode);
    setConfirmDistributionOpen(true);
    setConfirmRefreshing(true);
    void yieldStatus.refetch().finally(() => setConfirmRefreshing(false));
  };

  const dismissWorkflowOutcome = () => harvestDistribution.reset();

  // Unresolved outcomes clear only through reconciliation, and only once the
  // refetched reads prove something. A pending Safe submission has no
  // on-chain signal until it executes, so it clears when the refetched yield
  // state actually changes — never on an unchanged refetch, which would
  // invite a duplicate proposal. Unverified outcomes (split_unverified, an
  // uninspectable harvest receipt) clear once a reconciliation refetch
  // SUCCEEDS: the refreshed reads then reflect the real post-state, while a
  // failed refetch keeps the warning up.
  const yieldFingerprint = [
    yieldStatus.status,
    yieldStatus.totalAvailable,
    yieldStatus.registeredShares,
    yieldStatus.pendingYield,
  ].join("|");
  const [reconcileBaseline, setReconcileBaseline] = useState<{
    mode: "submitted" | "unverified";
    fingerprint: string;
  } | null>(null);
  const reconcileWorkflowOutcome = () => {
    const status = harvestDistribution.data?.status;
    const mode =
      status === "harvest_submitted" || status === "distribution_submitted"
        ? ("submitted" as const)
        : ("unverified" as const);
    const baseline = { mode, fingerprint: yieldFingerprint };
    void yieldStatus.refetch().finally(() => setReconcileBaseline(baseline));
  };
  const { reset: resetHarvestDistribution } = harvestDistribution;
  useEffect(() => {
    if (!reconcileBaseline || yieldStatus.isLoading) return;
    const reconciled =
      reconcileBaseline.mode === "unverified"
        ? !yieldStatus.isError
        : yieldFingerprint !== reconcileBaseline.fingerprint;
    if (!reconciled) return;
    resetHarvestDistribution();
    setReconcileBaseline(null);
  }, [
    reconcileBaseline,
    yieldFingerprint,
    yieldStatus.isLoading,
    yieldStatus.isError,
    resetHarvestDistribution,
  ]);

  const runHarvestDistribution = (harvestFirst: boolean) => {
    setReconcileBaseline(null);
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
    !yieldStatus.isLoading && !yieldStatus.isError && yieldStatus.isVaultRegistered;
  // Vault totalAssets only reflects strategy gains after process_report(), so
  // an empty yield status must not remove the harvest path: harvest stays
  // available whenever registered yield alone is not already distributable.
  const needsHarvestFirst = shouldHarvestFirst || yieldStatus.status !== "ready";
  // Re-derived every render so an open confirmation follows refreshed state.
  const confirmHarvestFirst =
    confirmMode === "auto" ? needsHarvestFirst : confirmMode === "harvest_first";
  const actionLabelId = needsHarvestFirst
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
        id: confirmHarvestFirst
          ? "app.yield.harvestDistribution.twoPrompts"
          : "app.yield.harvestDistribution.onePrompt",
      }),
    }
  );
  const confirmActionLabelId = confirmHarvestFirst
    ? "app.yield.harvestDistribution.action.harvest"
    : "app.yield.harvestDistribution.action.distribute";

  return (
    <div className="flex flex-col gap-2">
      <ItemRow
        lead={{ kind: "icon", icon: <RiBankLine /> }}
        title={assetSymbol}
        status={
          vaultAcceptingDeposits
            ? undefined
            : { label: formatMessage({ id: "app.treasury.depositsDisabled" }), tone: "warning" }
        }
        details={[
          formatMessage({ id: "app.treasury.depositorTotal" }, { count: vault.depositorCount }),
        ]}
        amount={{
          value: `${formatTokenAmount(netDeposited, assetDecimals, 4, undefined, true)} ${assetSymbol}`,
          caption: formatMessage({ id: "app.treasury.netDeposited" }),
        }}
        onOpen={() => setPageOpen(!pageOpen)}
        aria-expanded={pageOpen}
        aria-controls={pageId}
      />

      {/* Hidden, not unmounted: the workflow hooks above and the dialogs below keep their state. */}
      <div id={pageId} hidden={!pageOpen}>
        <div className="gg-card gg-item-row-page p-4">
          <a
            href={getBlockExplorerAddressUrl(chainId, vault.vaultAddress)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 type-meta text-primary-dark hover:underline"
          >
            {formatMessage({ id: "app.explorer.viewVault" })}:{" "}
            <EnsAddressText address={vault.vaultAddress} />
            <RiExternalLinkLine className="h-3 w-3" />
          </a>

          {/* Plain label and value rows: the page is the one container (D33). Net deposits and
              depositors are on the row above. */}
          <dl className="mt-2 divide-y divide-stroke-soft type-body">
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="type-meta-sm text-text-soft">
                {formatMessage({ id: "app.treasury.currentYield" })}
              </dt>
              <dd
                className={`font-semibold tabular-nums ${unharvestedImpactYield > 0n ? "text-success-dark" : "text-text-strong"}`}
              >
                {formatTokenAmount(unharvestedImpactYield, assetDecimals)} {assetSymbol}
                {unharvestedImpactYield > 0n && (
                  <span className="ml-1 type-meta font-normal">
                    {formatMessage({ id: "app.yield.accruing" })}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="type-meta-sm text-text-soft">
                {formatMessage({ id: "app.treasury.harvestCount" })}
              </dt>
              <dd className="font-semibold tabular-nums text-text-strong">
                {vault.totalHarvestCount}
              </dd>
            </div>
          </dl>

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

              {!hasWorkflowOutcome && yieldStatus.status === "error" && (
                <Alert variant="error" className="p-3">
                  {formatMessage({ id: "app.yield.harvestDistribution.statusUnavailable" })}
                </Alert>
              )}

              {/* Unavailable = no registered splitter vault on this network; a
                  refresh cannot change that, unlike a transient read error. */}
              {!hasWorkflowOutcome && yieldStatus.status === "unavailable" && (
                <Alert variant="info" className="p-3">
                  {formatMessage({ id: "app.yield.harvestDistribution.notAvailableOnNetwork" })}
                </Alert>
              )}

              {!hasWorkflowOutcome && yieldStatus.status === "loading" && (
                <div className="flex justify-end">
                  <AdminButton variant="outlined" size="sm" disabled loading>
                    {formatMessage({ id: "app.yield.harvestDistribution.action.harvest" })}
                  </AdminButton>
                </div>
              )}

              <HarvestOutcomeAlerts
                result={distributionResult}
                destinationAddress={yieldStatus.destination.address}
                isRetryPending={harvestDistribution.isPending}
                formatAmount={formatAmount}
                onRetry={openDistributionConfirm}
                onDismiss={dismissWorkflowOutcome}
                onReconcile={reconcileWorkflowOutcome}
              />

              {!hasWorkflowOutcome && canOpenDistribution && (
                <div className="flex justify-end">
                  {/* Outlined: Deposit is the page's one filled action (D9). */}
                  <AdminButton
                    variant="outlined"
                    size="sm"
                    onClick={() => openDistributionConfirm("auto")}
                    disabled={harvestDistribution.isPending}
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
        </div>
      </div>

      <AdminConfirmDialog
        isOpen={confirmDistributionOpen}
        onClose={() => setConfirmDistributionOpen(false)}
        onConfirm={() => runHarvestDistribution(confirmHarvestFirst)}
        title={formatMessage({ id: "app.yield.harvestDistribution.confirmTitle" })}
        description={confirmationDescription}
        confirmLabel={formatMessage({ id: confirmActionLabelId })}
        cancelLabel={formatMessage({ id: "app.wizard.cancel" })}
        tone="community"
        isLoading={harvestDistribution.isPending}
        confirmDisabled={
          confirmRefreshing ||
          yieldStatus.isLoading ||
          yieldStatus.isError ||
          !yieldStatus.destinationVerified
        }
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
    </div>
  );
}
