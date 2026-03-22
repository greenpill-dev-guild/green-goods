import {
  AAVE_V3_POOL,
  type Address,
  formatAddress,
  formatTokenAmount,
  getBlockExplorerAddressUrl,
  getNetDeposited,
  getNetworkContracts,
  getVaultAssetSymbol,
  OCTANT_MODULE_ABI,
  useCurrentChain,
  useGardenPermissions,
  useGardens,
  useGardenVaults,
  useUser,
} from "@green-goods/shared";
import { RiExternalLinkLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useParams } from "react-router-dom";
import { useReadContract } from "wagmi";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { DepositModal, PositionCard, VaultEventHistory, WithdrawModal } from "@/components/Vault";

type VaultRouteState = {
  returnTo?: string;
  returnLabelId?: string;
};

export default function GardenVaultView() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { formatMessage } = useIntl();
  const [depositAsset, setDepositAsset] = useState<string | undefined>(undefined);
  const [withdrawAsset, setWithdrawAsset] = useState<string | undefined>(undefined);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const routeState = (location.state as VaultRouteState | null) ?? null;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === id);
  const permissions = useGardenPermissions();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();

  // Check if current user is the OctantModule owner (can call enableAutoAllocate)
  const octantModuleAddress = getNetworkContracts(chainId).octantModule as Address | undefined;
  const { data: moduleOwner } = useReadContract({
    address: octantModuleAddress,
    abi: OCTANT_MODULE_ABI,
    functionName: "owner",
    query: { enabled: Boolean(octantModuleAddress && primaryAddress) },
  });
  const isModuleOwner =
    Boolean(primaryAddress) &&
    typeof moduleOwner === "string" &&
    moduleOwner.toLowerCase() === primaryAddress?.toLowerCase();

  const {
    vaults,
    isLoading: vaultsLoading,
    isError: vaultsHasError,
    refetch: refetchVaults,
    isFetching: vaultsFetching,
  } = useGardenVaults(garden?.id ?? id, {
    enabled: Boolean(garden?.id ?? id),
  });

  const { totalNetDeposited, totalHarvestCount, totalDepositorCount } = useMemo(() => {
    let netDeposited = 0n;
    let harvestCount = 0;
    let depositorCount = 0;
    for (const vault of vaults) {
      netDeposited += getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
      harvestCount += vault.totalHarvestCount;
      depositorCount += vault.depositorCount;
    }
    return {
      totalNetDeposited: netDeposited,
      totalHarvestCount: harvestCount,
      totalDepositorCount: depositorCount,
    };
  }, [vaults]);

  const tvlDenomination = useMemo(() => {
    const symbols = new Set(
      vaults.map((vault) => getVaultAssetSymbol(vault.asset, vault.chainId)).filter(Boolean)
    );

    if (symbols.size === 1) return Array.from(symbols)[0];
    if (symbols.size > 1) {
      return formatMessage({ id: "app.treasury.multiAssetDenomination" }, { count: symbols.size });
    }

    return formatMessage({ id: "app.treasury.tokenDenominationFallback" });
  }, [formatMessage, vaults]);

  const contextualBackLink = useMemo(() => {
    if (!routeState?.returnTo) return null;

    if (routeState.returnLabelId) {
      return {
        to: routeState.returnTo,
        label: formatMessage({
          id: routeState.returnLabelId,
          defaultMessage:
            routeState.returnTo === "/endowments"
              ? "Endowments"
              : formatMessage({ id: "app.common.back", defaultMessage: "Back" }),
        }),
      };
    }

    if (routeState.returnTo === "/endowments") {
      return {
        to: routeState.returnTo,
        label: formatMessage({ id: "app.admin.nav.treasury", defaultMessage: "Endowments" }),
      };
    }

    return {
      to: routeState.returnTo,
      label: formatMessage({ id: "app.common.back", defaultMessage: "Back" }),
    };
  }, [formatMessage, routeState?.returnLabelId, routeState?.returnTo]);

  if (gardensLoading) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.treasury.title" })}
          description={formatMessage({ id: "app.treasury.loadingGarden" })}
          backLink={
            contextualBackLink ?? {
              to: "/gardens",
              label: formatMessage({ id: "app.hypercerts.backToGardens" }),
            }
          }
        />
      </div>
    );
  }

  if (!garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.treasury.title" })}
          description={formatMessage({ id: "app.treasury.gardenNotFound" })}
          backLink={
            contextualBackLink ?? {
              to: "/gardens",
              label: formatMessage({ id: "app.hypercerts.backToGardens" }),
            }
          }
        />
      </div>
    );
  }

  const gardenAddress = garden.id as Address;
  const canManage = permissions.canManageGarden(garden);
  const canEmergencyPause = permissions.isOwnerOfGarden(garden);

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.treasury.title" })}
        description={formatMessage(
          { id: "app.treasury.gardenTreasuryDescription" },
          { gardenName: garden.name }
        )}
        backLink={
          contextualBackLink ?? {
            to: `/gardens/${garden.id}`,
            label: formatMessage({ id: "app.hypercerts.backToGarden" }),
          }
        }
        sticky
      />

      <div className="mx-auto mt-6 max-w-6xl space-y-6 px-4 sm:px-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.treasury.totalValueLocked" })}
            </p>
            <p className="mt-1 text-xl font-semibold text-text-strong">
              {formatTokenAmount(totalNetDeposited)} {tvlDenomination}
            </p>
          </div>
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.treasury.totalHarvests" })}
            </p>
            <p className="mt-1 text-xl font-semibold text-text-strong">{totalHarvestCount}</p>
          </div>
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.treasury.depositorCount" })}
            </p>
            <p className="mt-1 text-xl font-semibold text-text-strong">{totalDepositorCount}</p>
          </div>
        </section>

        {vaultsLoading && (
          <p className="text-sm text-text-soft">
            {formatMessage({ id: "app.treasury.loadingVaults" })}
          </p>
        )}

        {vaultsHasError && (
          <Alert
            variant="error"
            action={
              <button
                type="button"
                onClick={() => {
                  void refetchVaults();
                }}
                disabled={vaultsFetching}
                className="rounded-md border border-error-light px-3 py-1.5 text-xs font-medium text-error-dark hover:bg-error-lighter disabled:cursor-not-allowed disabled:opacity-60"
              >
                {vaultsFetching
                  ? formatMessage({ id: "app.common.refreshing" })
                  : formatMessage({ id: "app.common.tryAgain" })}
              </button>
            }
          >
            {formatMessage({ id: "app.treasury.errorLoading" })}
          </Alert>
        )}

        {!vaultsLoading && !vaultsHasError && vaults.length === 0 && (
          <p className="rounded-md border border-stroke-soft bg-bg-white px-4 py-3 text-sm text-text-soft">
            {formatMessage({ id: "app.treasury.noVault" })}
          </p>
        )}

        {!vaultsLoading && vaults.length > 0 && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {vaults.map((vault) => (
              <PositionCard
                key={vault.id}
                gardenAddress={gardenAddress}
                vault={vault}
                canManage={canManage}
                canEmergencyPause={canEmergencyPause}
                isModuleOwner={isModuleOwner}
                onDeposit={(assetAddress) => {
                  setDepositAsset(assetAddress);
                  setDepositOpen(true);
                }}
                onWithdraw={(assetAddress) => {
                  setWithdrawAsset(assetAddress);
                  setWithdrawOpen(true);
                }}
              />
            ))}
          </section>
        )}

        {!vaultsLoading && vaults.length > 0 && (
          <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
            <h3 className="label-sm text-text-strong">
              {formatMessage({ id: "app.explorer.contractDetails" })}
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              {vaults.map((vault) => (
                <div
                  key={`contract-${vault.id}`}
                  className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2"
                >
                  <span className="text-text-sub">
                    {getVaultAssetSymbol(vault.asset, vault.chainId)}{" "}
                    {formatMessage({ id: "app.explorer.vault" })}
                  </span>
                  <a
                    href={getBlockExplorerAddressUrl(chainId, vault.vaultAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-base hover:underline"
                  >
                    {formatAddress(vault.vaultAddress, { variant: "card" })}
                    <RiExternalLinkLine className="h-3 w-3" />
                  </a>
                </div>
              ))}
              {octantModuleAddress && (
                <div className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2">
                  <span className="text-text-sub">
                    {formatMessage({ id: "app.explorer.vaultRegistry" })}
                  </span>
                  <a
                    href={getBlockExplorerAddressUrl(chainId, octantModuleAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-base hover:underline"
                  >
                    {formatAddress(octantModuleAddress, { variant: "card" })}
                    <RiExternalLinkLine className="h-3 w-3" />
                  </a>
                </div>
              )}
              {AAVE_V3_POOL[chainId] && (
                <div className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2">
                  <span className="text-text-sub">
                    {formatMessage({ id: "app.explorer.aavePool" })}
                  </span>
                  <a
                    href={getBlockExplorerAddressUrl(chainId, AAVE_V3_POOL[chainId])}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-base hover:underline"
                  >
                    {formatAddress(AAVE_V3_POOL[chainId], { variant: "card" })}
                    <RiExternalLinkLine className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        <VaultEventHistory gardenAddress={gardenAddress} />
      </div>

      <DepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        gardenAddress={gardenAddress}
        vaults={vaults}
        defaultAsset={depositAsset}
      />
      <WithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        gardenAddress={gardenAddress}
        vaults={vaults}
        defaultAsset={withdrawAsset}
      />
    </div>
  );
}
