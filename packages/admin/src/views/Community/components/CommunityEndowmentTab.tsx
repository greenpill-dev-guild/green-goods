import {
  type Address,
  Alert,
  type CommunityWorkspace,
  formatTokenAmount,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminCard } from "@/components/AdminCard";
import { VaultContractDetails } from "@/components/Vault";
import GardenVaultView from "@/views/Garden/Vault";

export type CommunityEndowmentTabProps = Pick<
  CommunityWorkspace,
  "hasVaults" | "treasurySeverity" | "vaultNetDeposited"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityEndowmentTab({
  garden,
  hasVaults,
  treasurySeverity,
  vaultNetDeposited,
}: CommunityEndowmentTabProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          <GardenVaultView layout="sheet" />
        </div>
        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky space-y-4">
            <AdminCard variant="filled" className="space-y-3">
              <h3 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({ id: "cockpit.community.endowment.status" })}
              </h3>
              <AdminCard variant="outlined" density="compact">
                <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
                  {formatMessage({ id: "app.treasury.totalValueLocked" })}
                </p>
                <p className="mt-1 text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                  {hasVaults
                    ? formatTokenAmount(vaultNetDeposited)
                    : formatMessage({ id: "app.garden.detail.community.noVault" })}
                </p>
              </AdminCard>
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
