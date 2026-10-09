import { selectAllocationSplits } from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import { useIsProtocolGarden } from "@green-goods/shared/hooks/commitment-pooling/useProtocolPool";
import { useRole } from "@green-goods/shared/hooks/gardener/useRole";
import type { Address } from "@green-goods/shared/types/domain";
import { JAR_LIMIT_ROUTE_ITEM_PREFIX } from "@green-goods/shared/utils/cookie-jar-claim-limit";
import {
  adminRoutes,
  CAMPAIGN_JARS_ROUTE_ITEM,
  CREATE_CAMPAIGN_JAR_ROUTE_ITEM,
} from "@green-goods/shared/utils/navigation/admin-routes";
import { RiAddLine } from "@remixicon/react";
import { useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import {
  CampaignCookieJarCreateDialog,
  CampaignCookieJarPanel,
} from "@/views/Cookies/components/CampaignCookieJar";
import { CookieJarPayoutPanel } from "@/views/Hub/components/CookieJarPayoutPanel";

export type CommunityPayoutsTabProps = Pick<
  CommunityWorkspace,
  "allocations" | "allocationsAtLimit" | "selectedItem"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityPayoutsTab({
  garden,
  allocations,
  allocationsAtLimit,
  selectedItem,
}: CommunityPayoutsTabProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const allocationSplits = selectAllocationSplits(allocations);
  const { isDeployer } = useRole();
  const { isProtocolGarden } = useIsProtocolGarden({
    chainId: garden.chainId,
    gardenId: garden.id as Address,
  });
  // Campaign cookie jars are a protocol-level surface: deployers only, in the
  // Green Goods Community Garden (DL-046).
  const showCampaignJars = isDeployer && isProtocolGarden;
  const campaignJarsRef = useRef<HTMLElement>(null);
  const campaignJarsRoute = (item: string) =>
    adminRoutes.communityPayouts({ gardenId: garden.id, item });
  // A workspace switch lands on this card (PageTransition reads its
  // data-route-item); this covers the card appearing once its reads resolve.
  useEffect(() => {
    if (showCampaignJars && selectedItem === CAMPAIGN_JARS_ROUTE_ITEM) {
      campaignJarsRef.current?.scrollIntoView({ block: "start" });
    }
  }, [selectedItem, showCampaignJars]);
  // The history list stops at its limit; a full list is a lower bound.
  const payoutCount = allocationsAtLimit
    ? formatMessage({ id: "cockpit.community.payouts.countAtLeast" }, { count: allocations.length })
    : allocations.length;

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
            allocationCountAtLeast={allocationsAtLimit}
          />
          {showCampaignJars ? (
            <section
              ref={campaignJarsRef}
              aria-label={formatMessage({
                id: "cockpit.community.cookies.title",
                defaultMessage: "Campaign Cookie Jars",
              })}
              data-region="campaign-cookie-jars"
              data-route-item={CAMPAIGN_JARS_ROUTE_ITEM}
              className="mt-4 scroll-mt-4"
            >
              <CampaignCookieJarPanel
                headerAction={
                  <AdminButton
                    type="button"
                    variant="tonal"
                    size="sm"
                    leadingIcon={<RiAddLine />}
                    onClick={() => navigate(campaignJarsRoute(CREATE_CAMPAIGN_JAR_ROUTE_ITEM))}
                  >
                    {formatMessage({
                      id: "cockpit.community.cookies.create",
                      defaultMessage: "Create Cookie Jar",
                    })}
                  </AdminButton>
                }
              />
            </section>
          ) : null}
          <CampaignCookieJarCreateDialog
            open={showCampaignJars && selectedItem === CREATE_CAMPAIGN_JAR_ROUTE_ITEM}
            onClose={() => navigate(campaignJarsRoute(CAMPAIGN_JARS_ROUTE_ITEM))}
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
                <span className="garden-stat-row-value">{payoutCount}</span>
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
