import { SkeletonGrid } from "@green-goods/shared/components/Skeleton";
import {
  type AdminIndexRedirectKind,
  resolveAdminIndexRedirect,
} from "@green-goods/shared/hooks/admin-ui/navigation/workspaceNavigation";
import type { UserRole } from "@green-goods/shared/hooks/gardener/useRole";
import type { ComponentType } from "react";
import { Navigate, type RouteObject, useLocation } from "react-router-dom";
import RequireRole from "@/routes/RequireRole";

type LazyRoute = NonNullable<RouteObject["lazy"]>;

function lazyView(loader: () => Promise<{ default: ComponentType }>): LazyRoute {
  return async () => ({ Component: (await loader()).default });
}

const hubView = lazyView(() => import("@/views/Hub"));
const gardenView = lazyView(() => import("@/views/Garden"));
const communityView = lazyView(() => import("@/views/Community"));
const cookiesView = lazyView(() => import("@/views/Cookies"));
const actionsView = lazyView(() => import("@/views/Actions"));
const profileView = lazyView(() => import("@/views/Profile"));
const createGardenView = lazyView(() => import("@/views/Garden/CreateGarden"));
const createAssessmentView = lazyView(() => import("@/views/Hub/CreateAssessment"));
const createHypercertView = lazyView(() => import("@/views/Hub/CreateHypercert"));
const submitWorkView = lazyView(() => import("@/views/Garden/SubmitWork"));

function RoleGateSkeleton() {
  return (
    <div className="p-6 space-y-6" data-testid="content-skeleton">
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

function PreserveSearchRedirect({ pathname }: { pathname: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname, search: location.search }} replace />;
}

export const adminCanvasRoutes: RouteObject[] = [
  {
    path: "hub",
    children: [
      {
        index: true,
        element: <IndexRedirect kind="hub" />,
      },
      {
        // Submit Work is a creation/commit flow — its own full surface
        // (desktop full-screen dialog / mobile full-page route), not a Hub
        // inspector sheet. Keep this flattened before /work/:workId so the
        // static action route cannot be interpreted as a work id.
        path: "work/submit",
        lazy: submitWorkView,
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
        lazy: createAssessmentView,
      },
      {
        path: "assess",
        children: [
          {
            index: true,
            lazy: hubView,
          },
        ],
      },
      {
        path: "certify/create",
        lazy: createHypercertView,
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
            lazy: hubView,
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
        path: "settings",
        lazy: gardenView,
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
            lazy: communityView,
          },
          {
            path: "signal-pool/:poolType",
            lazy: communityView,
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
            lazy: communityView,
          },
          {
            path: "strategies",
            lazy: communityView,
          },
          {
            path: "signal-pool/:poolType",
            lazy: communityView,
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
        { index: true, lazy: cookiesView },
        { path: "deploy", lazy: cookiesView },
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
