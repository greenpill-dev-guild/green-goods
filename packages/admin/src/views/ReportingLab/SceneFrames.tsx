/**
 * Garden reporting lab (proposed component): the workspace frames the walkthrough's screens
 * sit in, built the way the shipped views build theirs (`views/Review/index.tsx`,
 * `views/Garden/index.tsx`, `views/Community/index.tsx`): CanvasRouteFrame, a sticky
 * CanvasRouteHeader with its MetaStrip, view actions and tab rail, and each workspace's own
 * stats, actions and tabs from the shared builders. Tab presses and actions are inert here;
 * the walkthrough moves between screens itself.
 */
import { MetaStrip, type MetaStripItem } from "@green-goods/shared/components/Canvas/MetaStrip";
import {
  buildCommunityHeaderStats,
  buildCommunityViewActions,
} from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import {
  buildGardenHeaderStats,
  buildGardenViewActions,
} from "@green-goods/shared/hooks/admin-ui/garden/garden.utils";
import {
  buildReviewViewActions,
  REVIEW_STAGE_RAIL_ID,
  PIPELINE_STAGE_CONFIG,
} from "@green-goods/shared/hooks/admin-ui/review/review.utils";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import type { AssetAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";

const ignore = () => undefined;

export type ReviewStage = (typeof PIPELINE_STAGE_CONFIG)[number]["id"];

interface ReviewFrameProps {
  stage: ReviewStage;
  /** What waits on the steward per stage (DL-134): pending work, promises to confirm. */
  counts: Partial<Record<ReviewStage, number>>;
  stats: MetaStripItem[];
  toolbar: ReactNode;
  resultsLabel: string;
  children: ReactNode;
}

/** The Review workspace as `views/Review/index.tsx` lays it out, with the stage's results inside. */
export function ReviewFrame({
  stage,
  counts,
  stats,
  toolbar,
  resultsLabel,
  children,
}: ReviewFrameProps) {
  const { formatMessage } = useIntl();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const actions = buildReviewViewActions(stage, true, true, ignore, {});

  return (
    <CanvasRouteFrame
      className="review-route-shell"
      data-component="ReviewWorkspace"
      data-region="workspace-review"
    >
      <div
        className="review-route-stack flex min-h-0 flex-1 flex-col"
        role="tabpanel"
        id={`${REVIEW_STAGE_RAIL_ID}-panel`}
        aria-labelledby={`${REVIEW_STAGE_RAIL_ID}-tab-${stage}`}
      >
        <CanvasRouteHeader
          wrapperClassName="review-route-content flex flex-col gap-4 sm:gap-5"
          title={formatMessage({ id: "hub.review.title", defaultMessage: "Review" })}
          description={formatMessage({
            id: "hub.review.description",
            defaultMessage: "Review and triage pending submissions.",
          })}
          metadata={stats.length > 0 ? <MetaStrip items={stats} density="inline" /> : undefined}
          variant="canvas"
          sticky
          actions={isDesktop ? <AdminViewActions items={actions} /> : undefined}
          toolbar={toolbar}
        >
          <AdminTabRail
            idBase={REVIEW_STAGE_RAIL_ID}
            tabs={PIPELINE_STAGE_CONFIG.map((config) => ({
              id: config.id,
              label: formatMessage({ id: config.labelId, defaultMessage: config.defaultMessage }),
              icon: config.icon,
              count: counts[config.id],
            }))}
            activeId={stage}
            ariaLabel={formatMessage({
              id: "hub.review.tabRail",
              defaultMessage: "Review pipeline stages",
            })}
            onChange={ignore}
          />
        </CanvasRouteHeader>
        <CanvasRouteContent
          data-region="workspace-review-content"
          className="review-route-content flex flex-1 flex-col gap-4 sm:gap-5"
        >
          <section className="review-results-shell" aria-label={resultsLabel}>
            <div className="review-results-pane">{children}</div>
          </section>
        </CanvasRouteContent>
      </div>
    </CanvasRouteFrame>
  );
}

export type GardenView = "health" | "pool" | "activity" | "impact";

interface GardenFrameProps {
  view: GardenView;
  gardenerCount: number;
  impactCount: number;
  /** Open alerts: the count the Health tab carries on the rail. */
  alertCount: number;
  children: ReactNode;
}

/** The Garden workspace as `views/Garden/index.tsx` lays it out, for a steward. */
export function GardenFrame({
  view,
  gardenerCount,
  impactCount,
  alertCount,
  children,
}: GardenFrameProps) {
  const { formatMessage } = useIntl();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const stats = buildGardenHeaderStats({
    hasSelectedGarden: true,
    gardenerCount,
    impactCount,
    formatMessage,
  });
  const actions = buildGardenViewActions(view, true, true, ignore, {
    gardenId: "0x0000000000000000000000000000000000000b01",
  });

  return (
    <CanvasRouteFrame data-component="GardenWorkspace" data-region="workspace-garden">
      <CanvasRouteHeader
        title={formatMessage({ id: "hub.garden.title", defaultMessage: "Garden" })}
        metadata={stats.length > 0 ? <MetaStrip items={stats} density="inline" /> : undefined}
        actions={isDesktop ? <AdminViewActions items={actions} /> : undefined}
        variant="canvas"
        sticky
      >
        <AdminTabRail
          ariaLabel={formatMessage({
            id: "hub.garden.viewSwitcher",
            defaultMessage: "Garden views",
          })}
          activeId={view}
          onChange={ignore}
          tabs={[
            {
              id: "health",
              label: formatMessage({ id: "hub.garden.health", defaultMessage: "Health" }),
              count: alertCount || undefined,
            },
            {
              id: "pool",
              label: formatMessage({ id: "hub.garden.pool.tab", defaultMessage: "Promises" }),
            },
            {
              id: "activity",
              label: formatMessage({ id: "hub.garden.activity", defaultMessage: "Activity" }),
            },
            {
              id: "impact",
              label: formatMessage({ id: "hub.garden.impact", defaultMessage: "Impact" }),
            },
          ]}
        />
      </CanvasRouteHeader>
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">{children}</div>
    </CanvasRouteFrame>
  );
}

/** The Health and Activity tabs' split: a main column and a sticky right rail (DL-051). */
export function GardenTabLayout({ main, rail }: { main: ReactNode; rail: ReactNode }) {
  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">{main}</div>
        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">{rail}</div>
        </aside>
      </div>
    </div>
  );
}

export type CommunityView = "members" | "endowment" | "payouts";

interface CommunityFrameProps {
  view: CommunityView;
  /** What the garden's endowment holds, per asset, for the header's stat. */
  endowment: readonly AssetAmount[];
  children: ReactNode;
}

/** The Community workspace as `views/Community/index.tsx` lays it out, for a steward. */
export function CommunityFrame({ view, endowment, children }: CommunityFrameProps) {
  const { formatMessage, locale } = useIntl();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // Payouts read from allocations; the lab has none it could read, so the stat stays off.
  const stats = buildCommunityHeaderStats({
    hasSelectedGarden: true,
    endowmentByAsset: endowment,
    distributedAmounts: null,
    locale,
    formatMessage,
  });
  const actions = buildCommunityViewActions(view, true, false, true, ignore, {});

  return (
    <CanvasRouteFrame data-component="CommunityWorkspace" data-region="workspace-community">
      <CanvasRouteHeader
        title={formatMessage({ id: "hub.community.title", defaultMessage: "Community" })}
        metadata={stats.length > 0 ? <MetaStrip items={stats} density="inline" /> : undefined}
        actions={isDesktop ? <AdminViewActions items={actions} /> : undefined}
        variant="canvas"
        sticky
      >
        <AdminTabRail
          ariaLabel={formatMessage({
            id: "hub.community.viewSwitcher",
            defaultMessage: "Community views",
          })}
          activeId={view}
          onChange={ignore}
          tabs={[
            {
              id: "members",
              label: formatMessage({ id: "hub.community.members", defaultMessage: "Members" }),
            },
            {
              id: "endowment",
              label: formatMessage({
                id: "hub.community.endowment",
                defaultMessage: "Endowment",
              }),
            },
            {
              id: "payouts",
              label: formatMessage({ id: "hub.community.payouts", defaultMessage: "Payouts" }),
            },
          ]}
        />
      </CanvasRouteHeader>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </CanvasRouteFrame>
  );
}
