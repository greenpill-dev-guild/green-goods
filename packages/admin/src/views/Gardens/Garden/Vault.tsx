import {
  type Address,
  getNetDeposited,
  getNetworkContracts,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  OCTANT_MODULE_ABI,
  useCurrentChain,
  useGardenPermissions,
  useGardenVaults,
  useGardens,
  useUser,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useParams } from "react-router-dom";
import { useReadContract, useReadContracts } from "wagmi";
import { PageHeader } from "@/components/Layout/PageHeader";
import {
  buildAssetTotals,
  formatAssetTotal,
  getAssetTotalKey,
} from "@/components/Vault/assetTotals";
import { DepositModal, PositionCard, VaultEventHistory, WithdrawModal } from "@/components/Vault";

const TOKEN_DECIMALS_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

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

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === id);
  const permissions = useGardenPermissions();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();

  // Check if current user is the OctantModule owner (can call configureVaultRoles)
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

  const assetAddresses = useMemo(() => {
    const uniqueAssets = new Map<string, Address>();

    for (const vault of vaults) {
      uniqueAssets.set(getAssetTotalKey(vault.chainId, vault.asset), vault.asset);
    }

    return Array.from(uniqueAssets.entries()).map(([key, address]) => ({ key, address }));
  }, [vaults]);

  const { data: assetDecimalsResults } = useReadContracts({
    contracts: assetAddresses.map(({ address }) => ({
      address,
      abi: TOKEN_DECIMALS_ABI,
      functionName: "decimals" as const,
    })),
    query: {
      enabled: assetAddresses.length > 0,
    },
  });

  const assetDecimalsByKey = useMemo(() => {
    const decimals = new Map<string, number>();

    assetAddresses.forEach(({ key, address }, index) => {
      const result = assetDecimalsResults?.[index];
      const resolved =
        result?.status === "success" && typeof result.result === "number"
          ? result.result
          : getVaultAssetDecimals(address, undefined);

      decimals.set(key, resolved);
    });

    return decimals;
  }, [assetAddresses, assetDecimalsResults]);

  const { totalHarvestCount, totalDepositorCount, totalAssetTotals } = useMemo(() => {
    let harvestCount = 0;
    let depositorCount = 0;
    for (const vault of vaults) {
      harvestCount += vault.totalHarvestCount;
      depositorCount += vault.depositorCount;
    }
    return {
      totalHarvestCount: harvestCount,
      totalDepositorCount: depositorCount,
      totalAssetTotals: buildAssetTotals(
        vaults.map((vault) => ({
          chainId: vault.chainId,
          assetAddress: vault.asset,
          amount: getNetDeposited(vault.totalDeposited, vault.totalWithdrawn),
          decimals:
            assetDecimalsByKey.get(getAssetTotalKey(vault.chainId, vault.asset)) ??
            getVaultAssetDecimals(vault.asset, vault.chainId),
          symbol: getVaultAssetSymbol(vault.asset, vault.chainId),
        }))
      ),
    };
  }, [assetDecimalsByKey, vaults]);

  const routeState =
    (location.state as VaultRouteState | null) ??
    ((typeof window !== "undefined" ? window.history.state?.usr : null) as VaultRouteState | null);

  if (gardensLoading) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.treasury.title" })}
          description={formatMessage({ id: "app.treasury.loadingGarden" })}
          backLink={
            typeof routeState?.returnTo === "string"
              ? {
                  to: routeState.returnTo,
                  label:
                    typeof routeState.returnLabelId === "string"
                      ? formatMessage({ id: routeState.returnLabelId })
                      : formatMessage({ id: "app.treasury.title" }),
                }
              : {
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
            typeof routeState?.returnTo === "string"
              ? {
                  to: routeState.returnTo,
                  label:
                    typeof routeState.returnLabelId === "string"
                      ? formatMessage({ id: routeState.returnLabelId })
                      : formatMessage({ id: "app.treasury.title" }),
                }
              : {
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
  const backLink =
    typeof routeState?.returnTo === "string"
      ? {
          to: routeState.returnTo,
          label:
            typeof routeState.returnLabelId === "string"
              ? formatMessage({ id: routeState.returnLabelId })
              : formatMessage({ id: "app.treasury.title" }),
        }
      : {
          to: `/gardens/${garden.id}`,
          label: formatMessage({ id: "app.hypercerts.backToGarden" }),
        };

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.treasury.title" })}
        description={formatMessage(
          { id: "app.treasury.gardenTreasuryDescription" },
          { gardenName: garden.name }
        )}
        backLink={backLink}
        sticky
      />

      <div className="mx-auto mt-6 max-w-6xl space-y-6 px-4 sm:px-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.treasury.totalValueLocked" })}
            </p>
            <div className="mt-1 space-y-1 text-xl font-semibold text-text-strong">
              {totalAssetTotals.length > 0 ? (
                totalAssetTotals.map((total) => <p key={total.key}>{formatAssetTotal(total)}</p>)
              ) : (
                <p>0</p>
              )}
            </div>
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
          <div
            role="alert"
            className="rounded-md border border-error-light bg-error-lighter px-4 py-3 text-sm text-error-dark"
          >
            <p>{formatMessage({ id: "app.treasury.errorLoading" })}</p>
            <button
              type="button"
              onClick={() => {
                void refetchVaults();
              }}
              disabled={vaultsFetching}
              className="mt-2 rounded-md border border-error-light px-3 py-1.5 text-xs font-medium text-error-dark hover:bg-error-lighter disabled:cursor-not-allowed disabled:opacity-60"
            >
              {vaultsFetching
                ? formatMessage({ id: "app.common.refreshing" })
                : formatMessage({ id: "app.common.tryAgain" })}
            </button>
          </div>
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

        <VaultEventHistory gardenAddress={gardenAddress} assetDecimalsByKey={assetDecimalsByKey} />
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
