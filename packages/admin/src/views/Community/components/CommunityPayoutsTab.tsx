import { Button } from "@green-goods/shared/components/Button";
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

  return (
    <div className="garden-tab-shell">
      {/* With no payout to split the rail has nothing to say, so the jars take the width. */}
      <div className={allocationSplits ? "garden-tab-layout" : "garden-tab-shell"}>
        <div className="garden-tab-main">
          <CookieJarPayoutPanel
            gardenAddress={garden.id as Address}
            gardenName={garden.name}
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
                  <Button
                    type="button"
                    emphasis="secondary"
                    size="compact"
                    leadingIcon={<RiAddLine className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => navigate(campaignJarsRoute(CREATE_CAMPAIGN_JAR_ROUTE_ITEM))}
                  >
                    {formatMessage({
                      id: "cockpit.community.cookies.create",
                      defaultMessage: "Create Cookie Jar",
                    })}
                  </Button>
                }
              />
            </section>
          ) : null}
          <CampaignCookieJarCreateDialog
            open={showCampaignJars && selectedItem === CREATE_CAMPAIGN_JAR_ROUTE_ITEM}
            onClose={() => navigate(campaignJarsRoute(CAMPAIGN_JARS_ROUTE_ITEM))}
          />
        </div>
        {allocationSplits ? (
          <aside className="garden-tab-rail">
            <div className="garden-tab-rail-sticky">
              <AdminCard variant="elevated" className="space-y-3">
                <AdminCardTitle>
                  {formatMessage({
                    id: "cockpit.community.payouts.readiness",
                    defaultMessage: "Payout readiness",
                  })}
                </AdminCardTitle>
                <div className="space-y-1.5">
                  <p className="mb-1.5 type-meta-sm font-medium text-text-sub">
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
                    <div key={id} className="flex items-center justify-between type-meta">
                      <span className="text-text-sub">{formatMessage({ id: id as string })}</span>
                      <span className="font-medium text-text-strong">{value}%</span>
                    </div>
                  ))}
                </div>
              </AdminCard>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
