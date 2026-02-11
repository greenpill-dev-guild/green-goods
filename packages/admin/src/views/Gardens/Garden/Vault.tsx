import {
  type Address,
  formatTokenAmount,
  getNetDeposited,
  isZeroAddressValue,
  useGardenPermissions,
  useGardenVaults,
  useGardens,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import {
  DepositModal,
  DonationAddressConfig,
  PositionCard,
  VaultEventHistory,
  WithdrawModal,
} from "@/components/Vault";

export default function GardenVaultView() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const [depositAsset, setDepositAsset] = useState<string | undefined>(undefined);
  const [withdrawAsset, setWithdrawAsset] = useState<string | undefined>(undefined);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === id);
  const permissions = useGardenPermissions();

  const { vaults, isLoading: vaultsLoading } = useGardenVaults(garden?.id ?? id, {
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
    return { totalNetDeposited: netDeposited, totalHarvestCount: harvestCount, totalDepositorCount: depositorCount };
  }, [vaults]);

  const donationAddress = useMemo(() => {
    const configured = vaults.find((vault) => !isZeroAddressValue(vault.donationAddress));
    return configured?.donationAddress ?? vaults[0]?.donationAddress ?? null;
  }, [vaults]);
  const donationUnset = isZeroAddressValue(donationAddress);

  if (gardensLoading) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.treasury.title" })}
          description={formatMessage({ id: "app.treasury.loadingGarden" })}
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.hypercerts.backToGardens" }),
          }}
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
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.hypercerts.backToGardens" }),
          }}
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
        backLink={{
          to: `/gardens/${garden.id}`,
          label: formatMessage({ id: "app.hypercerts.backToGarden" }),
        }}
        sticky
      />

      <div className="mx-auto mt-6 max-w-6xl space-y-6 px-4 sm:px-6">
        {donationUnset && vaults.length > 0 && (
          <div className="rounded-md border border-warning-light bg-warning-lighter px-4 py-3 text-sm text-warning-dark">
            {formatMessage({ id: "app.treasury.setDonationFirst" })}
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.treasury.totalValueLocked" })}
            </p>
            <p className="mt-1 text-xl font-semibold text-text-strong">
              {formatTokenAmount(totalNetDeposited)}
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

        <DonationAddressConfig
          gardenAddress={gardenAddress}
          donationAddress={donationAddress}
          canEdit={canManage}
        />

        {vaultsLoading && (
          <p className="text-sm text-text-soft">
            {formatMessage({ id: "app.treasury.loadingVaults" })}
          </p>
        )}

        {!vaultsLoading && vaults.length === 0 && (
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
