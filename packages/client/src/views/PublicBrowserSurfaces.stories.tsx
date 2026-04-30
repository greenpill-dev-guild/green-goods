import type { Meta, StoryObj } from "@storybook/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { expect, within } from "storybook/test";
import { withClientAppRuntime } from "../../../shared/.storybook/decorators";
import { CLIENT_ROUTE_IDS, appRoutes } from "../router.config";
import PublicShell from "../routes/PublicShell";
import Root from "../routes/Root";
import GardensGallery from "./Public/Gardens";
import PublicHome from "./Public/Home";

function findRouteById(routes: RouteObject[], id: string): RouteObject | undefined {
  for (const route of routes) {
    if (route.id === id) {
      return route;
    }
    const match = route.children ? findRouteById(route.children, id) : undefined;
    if (match) {
      return match;
    }
  }

  return undefined;
}

function findAllRoutesByPath(routes: RouteObject[], path: string): RouteObject[] {
  const matches: RouteObject[] = [];
  for (const route of routes) {
    if (route.path === path) {
      matches.push(route);
    }
    if (route.children) {
      matches.push(...findAllRoutesByPath(route.children, path));
    }
  }
  return matches;
}

function requirePublicRoutePath(routeId: string, expectedPath: string) {
  const publicShell = findRouteById(appRoutes, CLIENT_ROUTE_IDS.publicShell);
  const publicRoute = publicShell?.children?.find((route) => route.id === routeId);

  if (!publicRoute || publicRoute.path !== expectedPath) {
    throw new Error(
      `Expected ${expectedPath} to remain a child of ${CLIENT_ROUTE_IDS.publicShell}.`
    );
  }

  return publicRoute.path;
}

function requirePublicIndexRoute(routeId: string) {
  const publicShell = findRouteById(appRoutes, CLIENT_ROUTE_IDS.publicShell);
  const publicRoute = publicShell?.children?.find((route) => route.id === routeId);

  if (!publicRoute || publicRoute.index !== true) {
    throw new Error(`Expected ${routeId} to remain the public-shell index route.`);
  }
}

function requireRedirectOnlyPublicRoute(routeId: string, expectedPath: string) {
  const publicShell = findRouteById(appRoutes, CLIENT_ROUTE_IDS.publicShell);
  const publicRoute = publicShell?.children?.find((route) => route.id === routeId);

  if (
    !publicRoute ||
    publicRoute.path !== expectedPath ||
    typeof publicRoute.loader !== "function" ||
    publicRoute.lazy
  ) {
    throw new Error(`Expected ${expectedPath} to remain a redirect-only public route.`);
  }
}

// Sentinel: /landing must stay as a legacy redirect under the public shell. If
// a future agent revives the old landing component route, this throws at module
// load before the story renders.
const landingPaths = findAllRoutesByPath(appRoutes, "landing");
if (landingPaths.length !== 1) {
  throw new Error(
    `Expected /landing to appear exactly once in appRoutes (under public-shell); found ${landingPaths.length}.`
  );
}
requirePublicIndexRoute(CLIENT_ROUTE_IDS.publicHome);
requireRedirectOnlyPublicRoute(CLIENT_ROUTE_IDS.publicLanding, "landing");

function PublicRouteSentinel({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-text-strong-950">{title}</h1>
    </main>
  );
}

const publicStoryRoutes: RouteObject[] = [
  {
    id: CLIENT_ROUTE_IDS.root,
    element: <Root />,
    children: [
      {
        id: CLIENT_ROUTE_IDS.publicShell,
        element: <PublicShell />,
        children: [
          {
            index: true,
            element: <PublicHome />,
          },
          {
            path: requirePublicRoutePath(CLIENT_ROUTE_IDS.publicGardens, "gardens"),
            element: <GardensGallery />,
          },
          {
            path: requirePublicRoutePath(CLIENT_ROUTE_IDS.publicFund, "fund"),
            element: <PublicRouteSentinel title="Fund" />,
          },
          {
            path: requirePublicRoutePath(CLIENT_ROUTE_IDS.publicImpact, "impact"),
            element: <PublicRouteSentinel title="Impact" />,
          },
          {
            path: requirePublicRoutePath(CLIENT_ROUTE_IDS.publicActions, "actions"),
            element: <PublicRouteSentinel title="Actions" />,
          },
        ],
      },
    ],
  },
];

function PublicBrowserRoute({ route }: { route: string }) {
  const router = createMemoryRouter(publicStoryRoutes, {
    initialEntries: [route],
  });

  return (
    <div className="min-h-screen bg-bg-white-0 text-text-strong-950">
      <RouterProvider router={router} />
    </div>
  );
}

const meta = {
  title: "Client/Public/BrowserSurfaces",
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [withClientAppRuntime],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const HomeRoute: Story = {
  render: () => <PublicBrowserRoute route="/" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("banner")).toBeVisible();
    await expect(await canvas.findByRole("link", { name: /green goods logo/i })).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "Green Goods" })).toBeVisible();
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};

export const GardensRouteShell: Story = {
  render: () => <PublicBrowserRoute route="/gardens" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("navigation", { name: "Main navigation" })).toBeVisible();
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};

export const FundRouteShell: Story = {
  render: () => <PublicBrowserRoute route="/fund" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "Fund" })).toBeVisible();
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};

export const ImpactRouteShell: Story = {
  render: () => <PublicBrowserRoute route="/impact" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "Impact" })).toBeVisible();
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};

export const ActionsRouteShell: Story = {
  render: () => <PublicBrowserRoute route="/actions" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "Actions" })).toBeVisible();
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};
