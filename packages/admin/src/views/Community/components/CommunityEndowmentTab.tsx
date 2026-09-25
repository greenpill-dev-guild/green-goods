import { Alert } from "@green-goods/shared/components/Alert";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { VaultContractDetails } from "@/components/Vault";
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
  const heldAssets = endowmentByAsset.filter((entry) => entry.amount > 0n);

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          <GardenVaultView layout="sheet" />
        </div>
        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky space-y-4">
            <AdminCard variant="filled" className="space-y-3">
              <AdminCardTitle>
                {formatMessage({ id: "cockpit.community.endowment.status" })}
              </AdminCardTitle>
              {/* A plain label and value, one line per asset held: amounts of
                  different assets never add up (D14). */}
              <div>
                <p className="text-label-sm text-text-sub">
                  {formatMessage({ id: "app.treasury.totalValueLocked" })}
                </p>
                {!hasVaults ? (
                  <p className="mt-1 text-title-sm font-semibold text-text-strong">
                    {formatMessage({ id: "app.garden.detail.community.noVault" })}
                  </p>
                ) : heldAssets.length === 0 ? (
                  <p className="mt-1 text-title-sm font-semibold text-text-strong">0</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {heldAssets.map((entry) => (
                      <li
                        key={entry.asset}
                        className="text-title-sm font-semibold tabular-nums text-text-strong"
                      >
                        {formatTokenAmount(entry.amount, entry.decimals, 4, locale)} {entry.symbol}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
            {hasVaults ? <VaultContractDetails gardenAddress={garden.id as Address} /> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
