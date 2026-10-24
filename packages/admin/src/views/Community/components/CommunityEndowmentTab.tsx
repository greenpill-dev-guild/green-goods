import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { Alert } from "@green-goods/shared/components/Alert";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount, shownAssetAmounts } from "@green-goods/shared/utils/blockchain/vaults";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { GardenSupporters, VaultContractDetails } from "@/components/Vault";
import GardenVaultView from "@/views/Garden/Vault";

export type CommunityEndowmentTabProps = Pick<
  CommunityWorkspace,
  "hasVaults" | "treasurySeverity" | "endowmentByAsset"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityEndowmentTab({
  garden,
  hasVaults,
  treasurySeverity,
  endowmentByAsset,
}: CommunityEndowmentTabProps) {
  const { formatMessage, locale } = useIntl();
  const shownAssets = shownAssetAmounts(endowmentByAsset);
  const { vaults, isLoading, isError } = useGardenVaults(garden.id as Address, {
    enabled: hasVaults,
    chainId: garden.chainId,
  });
  const countsUnread = hasVaults && (isLoading || isError);
  const harvestCount = vaults.reduce((total, vault) => total + vault.totalHarvestCount, 0);
  const depositorCount = vaults.reduce((total, vault) => total + vault.depositorCount, 0);

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          <GardenVaultView layout="sheet" />
        </div>
        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <AdminCard variant="elevated" className="space-y-3">
              <AdminCardTitle>
                {formatMessage({ id: "cockpit.community.endowment.status" })}
              </AdminCardTitle>
              {/* A plain label and value, one line per asset held: amounts of
                  different assets never add up (D14). */}
              <div>
                <p className="type-meta-sm text-text-sub">
                  {formatMessage({ id: "app.treasury.totalValueLocked" })}
                </p>
                {!hasVaults ? (
                  <p className="mt-1 type-title-sm font-semibold text-text-strong">
                    {formatMessage({ id: "app.garden.detail.community.noVault" })}
                  </p>
                ) : shownAssets.length === 0 ? (
                  <p className="mt-1 type-title-sm font-semibold text-text-strong">0</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {shownAssets.map((entry) => (
                      <li
                        key={entry.asset}
                        className="type-title-sm font-semibold tabular-nums text-text-strong"
                      >
                        {formatTokenAmount(entry.amount, entry.decimals, 4, locale)} {entry.symbol}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <FactList frame="inset">
                <FactRow
                  label={formatMessage({ id: "app.treasury.totalHarvests" })}
                  value={countsUnread ? "—" : harvestCount}
                />
                <FactRow
                  label={formatMessage({ id: "app.treasury.depositorCount" })}
                  value={countsUnread ? "—" : depositorCount}
                />
              </FactList>
              {treasurySeverity !== "none" ? (
                <Alert
                  variant={treasurySeverity === "critical" ? "error" : "warning"}
                  className="p-3"
                >
                  {treasurySeverity === "critical"
                    ? formatMessage({ id: "app.garden.detail.alert.treasuryEmpty" })
                    : formatMessage({ id: "app.garden.detail.alert.treasuryMissing" })}
                </Alert>
              ) : null}
            </AdminCard>
            {hasVaults ? <GardenSupporters gardenAddress={garden.id as Address} /> : null}
            {hasVaults ? <VaultContractDetails gardenAddress={garden.id as Address} /> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
