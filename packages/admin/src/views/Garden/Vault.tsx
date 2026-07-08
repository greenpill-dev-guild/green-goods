import {
  type Address,
  Alert,
  adminRoutes,
  formatTokenAmount,
  getNetDeposited,
  getNetworkContracts,
  getVaultAssetSymbol,
  OCTANT_MODULE_ABI,
  useAdminGardenWorkspaceSelection,
  useCurrentChain,
  useGardenPermissions,
  useGardens,
  useGardenVaults,
  useUser,
} from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useReadContract } from "wagmi";
import { AdminButton } from "@/components/AdminButton";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import {
  GardenSupporters,
  PositionCard,
  VaultContractDetails,
  VaultEventHistory,
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
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const routeState = (location.state as VaultRouteState | null) ?? null;
  const resolvedGardenId = id ?? selectedGarden?.id;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === resolvedGardenId);
  const gardenRouteContext = {
    gardenId: garden?.id ?? selectedGarden?.id ?? resolvedGardenId,
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
    to: adminRoutes.communityEndowment(gardenRouteContext),
    label: formatMessage({ id: "cockpit.community.endowment" }),
  };

  if (gardensLoading) {
    if (layout === "sheet") {
      return <Alert variant="info">{formatMessage({ id: "app.treasury.loadingGarden" })}</Alert>;
    }

    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-6xl"
          title={formatMessage({ id: "cockpit.community.endowment" })}
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
          title={formatMessage({ id: "cockpit.community.endowment" })}
          description={formatMessage({ id: "app.treasury.gardenNotFound" })}
          backLink={treasuryBackLink}
        />
      </CanvasRouteFrame>
    );
  }

  const gardenAddress = garden.id as Address;
  const canManage = permissions.canManageGarden(garden);
  const canEmergencyPause = permissions.isOwnerOfGarden(garden);
  // layout="sheet" is only rendered by the endowment tab, which supplies a right rail that owns
  // the contract-details reference and wants a compact inline history (recent activity above the
  // fold). layout="page" (standalone) keeps both inline and shows the full history.
  const isEmbedded = layout === "sheet";
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
                navigate(
                  adminRoutes.communityEndowmentVaultDeposit({
                    ...gardenRouteContext,
                    item: assetAddress,
                  })
                );
              }}
              onWithdraw={(assetAddress) => {
                navigate(
                  adminRoutes.communityEndowmentVaultWithdraw({
                    ...gardenRouteContext,
                    item: assetAddress,
                  })
                );
              }}
            />
          ))}
        </section>
      )}

      <VaultEventHistory gardenAddress={gardenAddress} initialVisibleCount={isEmbedded ? 5 : 20} />

      {!vaultsLoading && vaults.length > 0 && <GardenSupporters gardenAddress={gardenAddress} />}

      {!isEmbedded && !vaultsLoading && vaults.length > 0 && (
        <VaultContractDetails gardenAddress={gardenAddress} />
      )}
    </>
  );

  if (layout === "sheet") {
    return <div className="flex flex-col gap-section overflow-x-hidden">{content}</div>;
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        maxWidthClassName="max-w-6xl"
        title={formatMessage({ id: "cockpit.community.endowment" })}
        description={formatMessage({ id: "cockpit.community.endowment.description" })}
        backLink={treasuryBackLink}
        sticky
      />

      <CanvasRouteContent maxWidthClassName="max-w-6xl" className="mt-6 flex flex-col gap-section">
        {content}
      </CanvasRouteContent>
    </CanvasRouteFrame>
  );
}
