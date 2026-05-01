import { adminRoutes, SkeletonGrid, type UserRole } from "@green-goods/shared";
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

function preserveSearch(search: string, omitKeys: string[] = []): string {
  if (!search) return "";

  const params = new URLSearchParams(search);
  for (const key of omitKeys) {
    params.delete(key);
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

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

const HubIndexRedirect = () => {
  const location = useLocation();
  return (
    <Navigate to={`${adminRoutes.hubWork()}${preserveSearch(location.search, ["view"])}`} replace />
  );
};

const GardenIndexRedirect = () => {
  const location = useLocation();
  return (
    <Navigate
      to={`${adminRoutes.gardenOverview()}${preserveSearch(location.search, ["view"])}`}
      replace
    />
  );
};

const CommunityIndexRedirect = () => {
  const location = useLocation();
  return (
    <Navigate
      to={`${adminRoutes.communityTreasury()}${preserveSearch(location.search, ["card", "pool"])}`}
      replace
    />
  );
};

export const adminCanvasRoutes: RouteObject[] = [
  {
    path: "hub",
    children: [
      {
        index: true,
        element: <HubIndexRedirect />,
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
          {
            path: "submit",
            lazy: hubView,
          },
        ],
      },
      {
        path: "assess",
        children: [
          {
            index: true,
            lazy: hubView,
          },
          {
            path: "create",
            lazy: createAssessmentView,
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
          {
            path: "create",
            lazy: createHypercertView,
          },
        ],
      },
      {
        path: "history",
        children: [
          {
            index: true,
            lazy: hubView,
          },
          {
            path: ":historyEventId",
            lazy: hubView,
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
        element: <GardenIndexRedirect />,
      },
      {
        path: "overview",
        lazy: gardenView,
      },
      {
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
        element: <CommunityIndexRedirect />,
      },
      {
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
        ],
      },
      {
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
      {
        path: "payouts",
        lazy: communityView,
      },
      {
        path: "members",
        lazy: communityView,
      },
    ],
  },
  {
    path: "cookies",
    children: [
      {
        index: true,
        lazy: cookiesView,
      },
      {
        path: "deploy",
        lazy: cookiesView,
      },
    ],
  },
  {
    path: "actions",
    lazy: actionsView,
  },
  {
    path: "profile",
    lazy: profileView,
  },
  {
    path: "actions/create",
    ...roleGatedRoute(["deployer"], actionsView),
  },
  {
    path: "actions/:id",
    lazy: actionsView,
  },
  {
    path: "actions/:id/edit",
    ...roleGatedRoute(["deployer"], actionsView),
  },
];
