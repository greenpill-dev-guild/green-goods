import { Alert } from "@green-goods/shared/components/Alert";
import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useAdminGardenWorkspaceSelection } from "@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection";
import { useGardenPermissions } from "@green-goods/shared/hooks/garden/useGardenPermissions";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import type { Address } from "@green-goods/shared/types/domain";
import { OCTANT_MODULE_ABI } from "@green-goods/shared/utils/blockchain/abis/octant";
import { getNetworkContracts } from "@green-goods/shared/utils/blockchain/contracts";
import {
  formatAssetAmounts,
  summarizeNetDepositsByAsset,
} from "@green-goods/shared/utils/blockchain/vaults";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiBankLine, RiErrorWarningLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { isAddress } from "viem";
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
  const { formatMessage, locale } = useIntl();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const routeState = (location.state as VaultRouteState | null) ?? null;
  const resolvedGardenId = id ?? selectedGarden?.id;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === resolvedGardenId);
  const vaultGardenId = garden?.id ?? resolvedGardenId;
  const vaultGardenAddress = vaultGardenId && isAddress(vaultGardenId) ? vaultGardenId : undefined;
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
  } = useGardenVaults(vaultGardenAddress, {
    enabled: Boolean(vaultGardenAddress),
  });

  const { endowmentByAsset, totalHarvestCount, totalDepositorCount } = useMemo(() => {
    let harvestCount = 0;
    let depositorCount = 0;
    for (const vault of vaults) {
      harvestCount += vault.totalHarvestCount;
      depositorCount += vault.depositorCount;
    }
    return {
      // Per asset: WETH and DAI base units never add up (D14).
      endowmentByAsset: summarizeNetDepositsByAsset(vaults, vaults[0]?.chainId),
      totalHarvestCount: harvestCount,
      totalDepositorCount: depositorCount,
    };
  }, [vaults]);

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
      {!isEmbedded ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="surface-inset">
            <p className="type-meta text-text-soft">
              {formatMessage({ id: "app.treasury.totalValueLocked" })}
            </p>
            <p className="mt-1 type-title-md font-semibold text-text-strong">
              {formatAssetAmounts(endowmentByAsset, locale)}
            </p>
          </div>
          <div className="surface-inset">
            <p className="type-meta text-text-soft">
              {formatMessage({ id: "app.treasury.totalHarvests" })}
            </p>
            <p className="mt-1 type-title-md font-semibold text-text-strong">{totalHarvestCount}</p>
          </div>
          <div className="surface-inset">
            <p className="type-meta text-text-soft">
              {formatMessage({ id: "app.treasury.depositorCount" })}
            </p>
            <p className="mt-1 type-title-md font-semibold text-text-strong">
              {totalDepositorCount}
            </p>
          </div>
        </section>
      ) : null}

      {vaultsLoading && (
        // The positions' own frames while they load, so the rows land where these stood.
        <div className="flex flex-col gap-(--gg-list-gap)" role="status" aria-live="polite">
          <span className="sr-only">{formatMessage({ id: "app.treasury.loadingVaults" })}</span>
          {[0, 1].map((index) => (
            <ItemRowSkeleton key={index} lead="icon" amount />
          ))}
        </div>
      )}

      {vaultsHasError && (
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={formatMessage({ id: "app.treasury.errorLoading" })}
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
        />
      )}

      {!vaultsLoading && !vaultsHasError && vaults.length === 0 && (
        <EmptyState icon={<RiBankLine />} title={formatMessage({ id: "app.treasury.noVault" })} />
      )}

      {!vaultsLoading && vaults.length > 0 && (
        // Said once for every vault, not repeated on each card (D27).
        <p className="type-body text-text-sub">
          {formatMessage({ id: "app.treasury.impactYieldHelper" })}
        </p>
      )}

      {!vaultsLoading && vaults.length > 0 && (
        <section className="flex flex-col gap-(--gg-list-gap)">
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

      {!isEmbedded && !vaultsLoading && vaults.length > 0 && (
        <GardenSupporters gardenAddress={gardenAddress} />
      )}

      {!isEmbedded && !vaultsLoading && vaults.length > 0 && (
        <VaultContractDetails gardenAddress={gardenAddress} />
      )}
    </>
  );

  if (layout === "sheet") {
    return <div className="@container flex min-w-0 flex-col gap-section">{content}</div>;
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

      <CanvasRouteContent
        maxWidthClassName="max-w-6xl"
        className="@container mt-6 flex flex-col gap-section"
      >
        {content}
      </CanvasRouteContent>
    </CanvasRouteFrame>
  );
}
