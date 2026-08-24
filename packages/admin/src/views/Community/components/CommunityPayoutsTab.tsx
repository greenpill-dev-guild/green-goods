import { selectAllocationSplits } from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import type { Address } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { AdminCard } from "@/components/AdminCard";
import { CookieJarPayoutPanel } from "@/views/Hub/components/CookieJarPayoutPanel";

export type CommunityPayoutsTabProps = Pick<CommunityWorkspace, "allocations" | "selectedItem"> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityPayoutsTab({
  garden,
  allocations,
  selectedItem,
}: CommunityPayoutsTabProps) {
  const { formatMessage } = useIntl();
  const allocationSplits = selectAllocationSplits(allocations);

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          <CookieJarPayoutPanel
            gardenAddress={garden.id as Address}
            routeAction={selectedItem === "fund-jar" ? "deposit" : null}
            allocationCount={allocations.length}
          />
        </div>
        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <AdminCard variant="filled" className="space-y-3">
              <h3 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.payouts.readiness",
                  defaultMessage: "Payout readiness",
                })}
              </h3>
              <AdminCard variant="outlined" density="compact">
                <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
                  {formatMessage({
                    id: "cockpit.community.payouts.historyCount",
                    defaultMessage: "Allocation events",
                  })}
                </p>
                <p className="mt-1 text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                  {allocations.length}
                </p>
              </AdminCard>
              {allocationSplits ? (
                <div className="space-y-1.5 border-t border-stroke-soft pt-3">
                  <p className="mb-1.5 text-label-sm font-medium text-[rgb(var(--m3-on-surface-variant))]">
                    {formatMessage({
                      id: "app.garden.detail.community.yieldAllocationHint",
                      defaultMessage: "How yield is distributed",
                    })}
                  </p>
                  {[
                    ["app.garden.detail.community.cookieJar", allocationSplits.cookieJar],
                    ["app.garden.detail.community.hypercertFrac", allocationSplits.fractions],
                    ["app.garden.detail.community.endowment", allocationSplits.endowment],
                  ].map(([id, value]) => (
                    <div key={id} className="flex items-center justify-between text-body-sm">
                      <span className="text-[rgb(var(--m3-on-surface-variant))]">
                        {formatMessage({ id: id as string })}
                      </span>
                      <span className="font-medium text-[rgb(var(--m3-on-surface))]">{value}%</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </AdminCard>
          </div>
        </aside>
      </div>
    </div>
  );
}
