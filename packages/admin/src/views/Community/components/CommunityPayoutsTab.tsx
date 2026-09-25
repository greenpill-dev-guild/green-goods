import { selectAllocationSplits } from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import type { Address } from "@green-goods/shared/types/domain";
import { JAR_LIMIT_ROUTE_ITEM_PREFIX } from "@green-goods/shared/utils/cookie-jar-claim-limit";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
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
            gardenName={garden.name}
            routeAction={selectedItem === "fund-jar" ? "deposit" : null}
            routeEditLimitJar={
              selectedItem?.startsWith(JAR_LIMIT_ROUTE_ITEM_PREFIX)
                ? selectedItem.slice(JAR_LIMIT_ROUTE_ITEM_PREFIX.length)
                : null
            }
            allocationCount={allocations.length}
          />
        </div>
        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <AdminCard variant="filled" className="space-y-3">
              <AdminCardTitle>
                {formatMessage({
                  id: "cockpit.community.payouts.readiness",
                  defaultMessage: "Payout readiness",
                })}
              </AdminCardTitle>
              {/* A plain row inside the card, not a card of its own (D33). */}
              <div className="garden-stat-row">
                <span className="garden-stat-row-label">
                  {formatMessage({
                    id: "cockpit.community.payouts.historyCount",
                    defaultMessage: "Payouts so far",
                  })}
                </span>
                <span className="garden-stat-row-value">{allocations.length}</span>
              </div>
              {allocationSplits ? (
                <div className="space-y-1.5 border-t border-stroke-soft pt-3">
                  <p className="mb-1.5 text-label-sm font-medium text-text-sub">
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
                      <span className="text-text-sub">{formatMessage({ id: id as string })}</span>
                      <span className="font-medium text-text-strong">{value}%</span>
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
