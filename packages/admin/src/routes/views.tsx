import { GOVERNANCE_ENABLED } from "@green-goods/shared/config/app";
import { getNetworkConfig } from "@green-goods/shared/config/blockchain";
import { SkeletonGrid } from "@green-goods/shared/components/Skeleton";
import {
  type AdminIndexRedirectKind,
  resolveAdminIndexRedirect,
} from "@green-goods/shared/hooks/admin-ui/navigation/workspaceNavigation";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import type { UserRole } from "@green-goods/shared/hooks/gardener/useRole";
import {
  adminRoutes,
  CREATE_ASSESSMENT_ROUTE_ITEM,
  CREATE_HYPERCERT_ROUTE_ITEM,
  EDIT_GARDEN_ROUTE_ITEM,
  resolveCampaignCookieJarsRoute,
  SUBMIT_WORK_ROUTE_ITEM,
} from "@green-goods/shared/utils/navigation/admin-routes";
import type { ComponentType } from "react";
import { Navigate, type RouteObject, useLocation, useParams } from "react-router-dom";
import RequireRole from "@/routes/RequireRole";
import RequireCommunityAccess from "@/routes/RequireCommunityAccess";

type LazyRoute = NonNullable<RouteObject["lazy"]>;

function lazyView(loader: () => Promise<{ default: ComponentType }>): LazyRoute {
  return async () => ({ Component: (await loader()).default });
}

const hubView = lazyView(() => import("@/views/Hub"));
const gardenView = lazyView(() => import("@/views/Garden"));
const communityView = lazyView(() => import("@/views/Community"));
const actionsView = lazyView(() => import("@/views/Actions"));
const profileView = lazyView(() => import("@/views/Profile"));
const createGardenView = lazyView(() => import("@/views/Garden/CreateGarden"));

function RoleGateSkeleton() {
  return (
    <div className="space-y-6 py-6 min-[600px]:px-6" data-testid="content-skeleton">
      <div className="h-9 w-48 rounded-md skeleton-shimmer" />
      <SkeletonGrid count={4} columns={2} />
    </div>
  );
}

function roleGatedRoute(allowedRoles: UserRole[], lazy: LazyRoute): RouteObject {
  return {
    element: <RequireRole allowedRoles={allowedRoles} loadingFallback={<RoleGateSkeleton />} />,
    children: [{ index: true, lazy }],
  };
}

function roleGatedBranch(allowedRoles: UserRole[], children: RouteObject[]): RouteObject {
  return {
    element: <RequireRole allowedRoles={allowedRoles} loadingFallback={<RoleGateSkeleton />} />,
    children,
  };
}

function IndexRedirect({ kind }: { kind: AdminIndexRedirectKind }) {
  const location = useLocation();
  return <Navigate to={resolveAdminIndexRedirect(kind, location.search)} replace />;
}

/** Keeps the URL's search; `item` adds the route item of a dialog the old address opened. */
function PreserveSearchRedirect({ pathname, item }: { pathname: string; item?: string }) {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  if (item) search.set("item", item);
  return <Navigate to={{ pathname, search: search.toString() }} replace />;
}

/**
 * An assessment's record opens under the Assessments tab (DL-082). A link to
 * its former address under Certify still opens it there.
 */
function AssessmentRecordRedirect() {
  const { assessmentId = "" } = useParams<{ assessmentId: string }>();
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: adminRoutes.hubAssessDetail(assessmentId), search: location.search }}
      replace
    />
  );
}

/**
 * Campaign cookie jars live on the protocol garden's Community → Payouts
 * (DL-046); these URLs keep working. The chain config names the root garden
 * before any read.
 */
function CampaignCookieJarsRedirect({ create = false }: { create?: boolean }) {
  const chainId = useCurrentChain();
  const rootGarden = getNetworkConfig(chainId).rootGarden?.address;
  return <Navigate to={resolveCampaignCookieJarsRoute(rootGarden, { create })} replace />;
}

const governanceRoute: Pick<RouteObject, "lazy" | "element"> = GOVERNANCE_ENABLED
  ? { lazy: communityView }
  : { element: <PreserveSearchRedirect pathname="/community/coordination" /> };

export const adminCanvasRoutes: RouteObject[] = [
  {
    path: "hub",
    children: [
      {
        index: true,
        element: <IndexRedirect kind="hub" />,
      },
      {
        // The create flows are route items that open over the active stage now
        // (DL-140); saved links open each over its own stage. Keep this flattened
        // before /work/:workId so it cannot be interpreted as a work id.
        path: "work/submit",
        element: <PreserveSearchRedirect pathname="/hub/work" item={SUBMIT_WORK_ROUTE_ITEM} />,
      },
      {
        path: "work",
        children: [
          {
            index: true,
            lazy: hubView,
          },
          {
            path: ":workId",
            lazy: hubView,
          },
        ],
      },
      {
        path: "assess/create",
        element: (
          <PreserveSearchRedirect pathname="/hub/assess" item={CREATE_ASSESSMENT_ROUTE_ITEM} />
        ),
      },
      {
        path: "assess",
        children: [
          {
            index: true,
            lazy: hubView,
          },
          {
            path: ":assessmentId",
            lazy: hubView,
          },
        ],
      },
      {
        path: "certify/create",
        element: (
          <PreserveSearchRedirect pathname="/hub/certify" item={CREATE_HYPERCERT_ROUTE_ITEM} />
        ),
      },
      {
        // Commitments waiting on a steward's confirmation (uiux-spec §6.9).
        // A row opens the commitment dialog in place, route-backed.
        path: "confirm",
        children: [
          {
            index: true,
            lazy: hubView,
          },
          {
            path: ":commitmentId",
            lazy: hubView,
          },
        ],
      },
      {
        path: "certify",
        children: [
          {
            index: true,
            lazy: hubView,
          },
          {
            path: ":assessmentId",
            element: <AssessmentRecordRedirect />,
          },
        ],
      },
      {
        // The History stage is retired (2026-08-25 AD-3); saved deep links
        // land on the Hub's default stage instead of a 404.
        path: "history",
        children: [
          {
            index: true,
            element: <PreserveSearchRedirect pathname="/hub" />,
          },
          {
            path: ":historyEventId",
            element: <PreserveSearchRedirect pathname="/hub" />,
          },
        ],
      },
    ],
  },
  {
    path: "garden",
    children: [
      {
        index: true,
        element: <IndexRedirect kind="garden" />,
      },
      {
        path: "health",
        lazy: gardenView,
      },
      {
        path: "overview",
        element: <IndexRedirect kind="garden-overview" />,
      },
      {
        path: "activity",
        lazy: gardenView,
      },
      {
        // Membership is community-owned — redirect retained so existing
        // /garden/members bookmarks and deep links do not 404.
        path: "members",
        element: <IndexRedirect kind="garden-members" />,
      },
      {
        // Legacy /garden/impact remains canonical for outcome/proof readouts
        // and hypercert deep links.
        path: "impact",
        children: [
          {
            index: true,
            lazy: gardenView,
          },
          {
            path: "hypercerts/:hypercertId",
            lazy: gardenView,
          },
        ],
      },
      {
        // Edit Garden is a route item now (DL-140); saved links open it over Health.
        path: "settings",
        element: <PreserveSearchRedirect pathname="/garden/health" item={EDIT_GARDEN_ROUTE_ITEM} />,
      },
      {
        // The steward's pool console (uiux-spec §6.2). The seeding console and
        // the commitment inspector are route-backed dialogs over the Pool tab,
        // the way the hypercert inspector sits over Impact.
        path: "pool",
        children: [
          {
            index: true,
            lazy: gardenView,
          },
          {
            path: "seed",
            lazy: gardenView,
          },
          {
            path: ":commitmentId",
            lazy: gardenView,
          },
        ],
      },
      {
        path: "create",
        ...roleGatedRoute(["deployer"], createGardenView),
      },
    ],
  },
  {
    path: "community",
    element: <RequireCommunityAccess loadingFallback={<RoleGateSkeleton />} />,
    children: [
      {
        index: true,
        element: <IndexRedirect kind="community" />,
      },
      {
        path: "members",
        lazy: communityView,
      },
      {
        path: "coordination",
        children: [
          {
            index: true,
            lazy: communityView,
          },
          {
            path: "strategies",
            ...governanceRoute,
          },
          {
            path: "signal-pool/:poolType",
            ...governanceRoute,
          },
        ],
      },
      {
        path: "endowment",
        children: [
          {
            index: true,
            lazy: communityView,
          },
          {
            path: "vault",
            lazy: communityView,
          },
          {
            path: "vault/deposit",
            lazy: communityView,
          },
          {
            path: "vault/withdraw",
            lazy: communityView,
          },
        ],
      },
      {
        path: "payouts",
        lazy: communityView,
      },
      {
        // The Pools tab retired into Coordination (2026-08-25 AD-5); the W12
        // surface (protocol pool + this garden, uiux-spec §6.8) renders there
        // and saved deep links land on it.
        path: "pools",
        element: <PreserveSearchRedirect pathname="/community/coordination" />,
      },
      {
        // Legacy resources URLs alias into Endowment until external links move.
        path: "resources",
        children: [
          {
            index: true,
            lazy: communityView,
          },
          {
            path: "vault",
            lazy: communityView,
          },
          {
            path: "vault/deposit",
            lazy: communityView,
          },
          {
            path: "vault/withdraw",
            lazy: communityView,
          },
        ],
      },
      {
        // Legacy treasury URLs alias into Endowment until external links move.
        path: "treasury",
        children: [
          {
            index: true,
            lazy: communityView,
          },
          {
            path: "vault",
            lazy: communityView,
          },
          {
            path: "vault/deposit",
            lazy: communityView,
          },
          {
            path: "vault/withdraw",
            lazy: communityView,
          },
        ],
      },
      {
        // Legacy governance URLs alias into Coordination until external links
        // move to /community/coordination.
        path: "governance",
        children: [
          {
            index: true,
            ...governanceRoute,
          },
          {
            path: "strategies",
            ...governanceRoute,
          },
          {
            path: "signal-pool/:poolType",
            ...governanceRoute,
          },
        ],
      },
    ],
  },
  {
    path: "cookies",
    ...roleGatedBranch(
      ["deployer"],
      [
        { index: true, element: <CampaignCookieJarsRedirect /> },
        { path: "deploy", element: <CampaignCookieJarsRedirect create /> },
      ]
    ),
  },
  {
    path: "actions",
    ...roleGatedBranch(
      ["deployer"],
      [
        { index: true, lazy: actionsView },
        { path: "create", lazy: actionsView },
        { path: ":id", lazy: actionsView },
        { path: ":id/edit", lazy: actionsView },
      ]
    ),
  },
  {
    path: "profile",
    lazy: profileView,
  },
];
