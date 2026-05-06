import {
  AAVE_V3_POOL,
  type Address,
  Alert,
  adminRoutes,
  formatAddress,
  formatTokenAmount,
  getBlockExplorerAddressUrl,
  getNetDeposited,
  getNetworkContracts,
  getVaultAssetSymbol,
  isZeroAddress,
  OCTANT_MODULE_ABI,
  useAdminGardenWorkspaceSelection,
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
import { AdminButton } from "@/components/AdminButton";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import {
  DepositModal,
  GardenSupporters,
  PositionCard,
  VaultEventHistory,
  WithdrawModal,
} from "@/components/Vault";

type VaultRouteState = {
  returnTo?: string;
  returnLabelId?: string;
};

interface GardenVaultViewProps {
  layout?: "page" | "sheet";
}

export default function GardenVaultView({ layout = "page" }: GardenVaultViewProps = {}) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { formatMessage } = useIntl();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const [depositAsset, setDepositAsset] = useState<string | undefined>(undefined);
  const [withdrawAsset, setWithdrawAsset] = useState<string | undefined>(undefined);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const routeState = (location.state as VaultRouteState | null) ?? null;
  const resolvedGardenId = id ?? selectedGarden?.id;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === resolvedGardenId);
  const gardenRouteContext = {
    gardenAddress:
      garden?.tokenAddress ?? garden?.id ?? selectedGarden?.tokenAddress ?? resolvedGardenId,
  };
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
  } = useGardenVaults(garden?.id ?? resolvedGardenId, {
    enabled: Boolean(garden?.id ?? resolvedGardenId),
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
          defaultMessage: formatMessage({ id: "app.common.back", defaultMessage: "Back" }),
        }),
      };
    }

    return {
      to: routeState.returnTo,
      label: formatMessage({ id: "app.common.back", defaultMessage: "Back" }),
    };
  }, [formatMessage, routeState?.returnLabelId, routeState?.returnTo]);
  const treasuryBackLink = contextualBackLink ?? {
    to: adminRoutes.communityTreasury(gardenRouteContext),
    label: formatMessage({ id: "app.admin.nav.treasury" }),
  };

  if (gardensLoading) {
    if (layout === "sheet") {
      return <Alert variant="info">{formatMessage({ id: "app.treasury.loadingGarden" })}</Alert>;
    }

    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-6xl"
          title={formatMessage({ id: "app.treasury.title" })}
          description={formatMessage({ id: "app.treasury.loadingGarden" })}
          backLink={treasuryBackLink}
        />
      </CanvasRouteFrame>
    );
  }

  if (!garden) {
    if (layout === "sheet") {
      return <Alert variant="error">{formatMessage({ id: "app.treasury.gardenNotFound" })}</Alert>;
    }

    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-6xl"
          title={formatMessage({ id: "app.treasury.title" })}
          description={formatMessage({ id: "app.treasury.gardenNotFound" })}
          backLink={treasuryBackLink}
        />
      </CanvasRouteFrame>
    );
  }

  const gardenAddress = garden.id as Address;
  const canManage = permissions.canManageGarden(garden);
  const canEmergencyPause = permissions.isOwnerOfGarden(garden);
  const content = (
    <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="surface-inset">
          <p className="body-xs text-text-soft">
            {formatMessage({ id: "app.treasury.totalValueLocked" })}
          </p>
          <p className="mt-1 text-xl font-semibold text-text-strong">
            {formatTokenAmount(totalNetDeposited)} {tvlDenomination}
          </p>
        </div>
        <div className="surface-inset">
          <p className="body-xs text-text-soft">
            {formatMessage({ id: "app.treasury.totalHarvests" })}
          </p>
          <p className="mt-1 text-xl font-semibold text-text-strong">{totalHarvestCount}</p>
        </div>
        <div className="surface-inset">
          <p className="body-xs text-text-soft">
            {formatMessage({ id: "app.treasury.depositorCount" })}
          </p>
          <p className="mt-1 text-xl font-semibold text-text-strong">{totalDepositorCount}</p>
        </div>
      </section>

      {vaultsLoading && (
        <p className="body-sm text-text-soft">
          {formatMessage({ id: "app.treasury.loadingVaults" })}
        </p>
      )}

      {vaultsHasError && (
        <Alert
          variant="error"
          action={
            <AdminButton
              type="button"
              variant="outlined"
              size="sm"
              onClick={() => {
                void refetchVaults();
              }}
              disabled={vaultsFetching}
            >
              {vaultsFetching
                ? formatMessage({ id: "app.common.refreshing" })
                : formatMessage({ id: "app.common.tryAgain" })}
            </AdminButton>
          }
        >
          {formatMessage({ id: "app.treasury.errorLoading" })}
        </Alert>
      )}

      {!vaultsLoading && !vaultsHasError && vaults.length === 0 && (
        <p className="rounded-md border border-stroke-soft bg-bg-white px-4 py-3 body-sm text-text-soft">
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

      {!vaultsLoading && vaults.length > 0 && <GardenSupporters gardenAddress={gardenAddress} />}

      {!vaultsLoading && vaults.length > 0 && (
        <section className="surface-section">
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
                  className="inline-flex items-center gap-1 body-xs text-primary-base hover:underline"
                >
                  {formatAddress(vault.vaultAddress, { variant: "card" })}
                  <RiExternalLinkLine className="h-3 w-3" />
                </a>
              </div>
            ))}
            {!isZeroAddress(octantModuleAddress) && (
              <div className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2">
                <span className="text-text-sub">
                  {formatMessage({ id: "app.explorer.vaultRegistry" })}
                </span>
                <a
                  href={getBlockExplorerAddressUrl(chainId, octantModuleAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 body-xs text-primary-base hover:underline"
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
                  className="inline-flex items-center gap-1 body-xs text-primary-base hover:underline"
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
    </>
  );

  const modals = (
    <>
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
    </>
  );

  if (layout === "sheet") {
    return (
      <div className="flex flex-col gap-section">
        {content}
        {modals}
      </div>
    );
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        maxWidthClassName="max-w-6xl"
        title={formatMessage({ id: "app.treasury.title" })}
        description={formatMessage(
          { id: "app.treasury.gardenTreasuryDescription" },
          { gardenName: garden.name }
        )}
        backLink={treasuryBackLink}
        sticky
      />

      <CanvasRouteContent maxWidthClassName="max-w-6xl" className="mt-6 flex flex-col gap-section">
        {content}
      </CanvasRouteContent>
      {modals}
    </CanvasRouteFrame>
  );
}
