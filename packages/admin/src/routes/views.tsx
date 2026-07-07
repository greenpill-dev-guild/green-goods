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
const submitWorkView = lazyView(() => import("@/views/Garden/SubmitWork"));
const manageMembersView = lazyView(() => import("@/views/Garden/ManageMembers"));

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

function roleGatedBranch(allowedRoles: UserRole[], children: RouteObject[]): RouteObject {
  return {
    element: <RequireRole allowedRoles={allowedRoles} loadingFallback={<RoleGateSkeleton />} />,
    children,
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

const GardenMembersRedirect = () => {
  const location = useLocation();
  // Manage Members is community-owned — old /garden/members links land on the
  // canonical /community/members route with their garden context intact.
  return (
    <Navigate to={`${adminRoutes.communityMembers()}${preserveSearch(location.search)}`} replace />
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
        path: "activity",
        lazy: gardenView,
      },
      {
        // Membership is community-owned — redirect retained so existing
        // /garden/members bookmarks and deep links do not 404.
        path: "members",
        element: <GardenMembersRedirect />,
      },
      {
        // Legacy /garden/impact retained so existing URLs and external links
        // do not 404. resolveGardenView falls back to "overview" for these
        // paths after the Tier 4 IA change (audit IA-Garden decision); the
        // hypercert sheet still opens via GardenSheetDescriptor.
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
        // Canonical Manage Members route — a create/commit-style action flow
        // (centered dialog over the Community workspace), mirroring
        // createAssessmentView / createHypercertView / submitWorkView.
        // Community owns membership, so the NavigationBar tab stays on
        // Community while the dialog is open.
        path: "members",
        lazy: manageMembersView,
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
