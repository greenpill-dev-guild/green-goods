/**
 * Where a failure surfaces in the real route tables.
 *
 * The tables are the shipped ones, with their error states and their shape. Only what each route
 * loads is stood in, and one route's code is made to fail the way it fails in production: its
 * `lazy` import rejects. React Router treats that differently from a loader or a render error (it
 * will not render the failed route at all), so a stand-in that throws from a loader proves less.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { createMemoryRouter, Outlet, type RouteObject, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/modules/app/error-events", () => ({
  trackErrorBoundary: vi.fn(),
}));

vi.mock("@green-goods/shared/modules/app/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { AppRecoveryViews } from "../../components/Errors/AppRecoveryViews";
import { PublicRecoveryViews } from "../../components/Errors/PublicRecoveryViews";
import { CLIENT_ROUTE_IDS, publicAppRoutes, pwaAppRoutes } from "../../config/routes";
import { renderWithProviders } from "../test-utils";

const GARDEN = "0x1111111111111111111111111111111111111111";
const APP_FRAME = [
  CLIENT_ROUTE_IDS.root,
  CLIENT_ROUTE_IDS.pwaRuntime,
  CLIENT_ROUTE_IDS.sessionGate,
  CLIENT_ROUTE_IDS.appShell,
];
const SITE_FRAME = [CLIENT_ROUTE_IDS.root, CLIENT_ROUTE_IDS.publicShell];

type Failing = (route: RouteObject) => boolean;
const byId =
  (id: string): Failing =>
  (route) =>
    route.id === id;
const byPath =
  (path: string): Failing =>
  (route) =>
    route.path === path;

function Page() {
  return <p>The page</p>;
}

/** A layout route's stand-in: it marks itself, so a test can read which frames are still up. */
function layout(name: string) {
  return function Layout() {
    return (
      <div data-layout={name}>
        <Outlet />
      </div>
    );
  };
}

/** The real table with every route's code stood in, and the chosen route's failing to arrive. */
function standIn(routes: RouteObject[], failing: Failing, error: Error): RouteObject[] {
  return routes.map((route) => {
    const {
      lazy,
      loader: _loader,
      children,
      ...rest
    } = route as RouteObject & {
      lazy?: unknown;
      loader?: unknown;
    };
    return {
      ...rest,
      ...(lazy
        ? {
            lazy: failing(route)
              ? () => Promise.reject(error)
              : async () => ({ Component: children ? layout(route.id ?? "layout") : Page }),
          }
        : {}),
      ...(children ? { children: standIn(children, failing, error) } : {}),
    } as RouteObject;
  });
}

function fail({
  table,
  views: Views,
  path,
  failing,
  error = new Error("The screen's code did not arrive"),
}: {
  table: RouteObject[];
  views: ComponentType<{ children: ReactNode }>;
  path: string;
  failing: Failing;
  error?: Error;
}) {
  const router = createMemoryRouter(standIn(table, failing, error), { initialEntries: [path] });
  renderWithProviders(
    <Views>
      <RouterProvider router={router} />
    </Views>
  );
  return router;
}

const site = (path: string, failing: Failing, error?: Error) =>
  fail({ table: publicAppRoutes, views: PublicRecoveryViews, path, failing, error });
const app = (path: string, failing: Failing) =>
  fail({ table: pwaAppRoutes, views: AppRecoveryViews, path, failing });

/** The layout routes still on screen, outermost first. */
const framesUp = () =>
  Array.from(document.querySelectorAll("[data-layout]"), (frame) =>
    frame.getAttribute("data-layout")
  );
const reloadButton = () => screen.getByRole("button", { name: "Reload" });

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("a failing route in the real route tables", () => {
  it("replaces a public page inside the site's frame", async () => {
    site("/impact", byId(CLIENT_ROUTE_IDS.publicImpact));

    expect(
      await screen.findByRole("heading", { level: 1, name: "This page could not be loaded" })
    ).toBeInTheDocument();
    expect(framesUp()).toEqual(SITE_FRAME);
    expect(screen.getByRole("link", { name: "Browse Gardens" })).toHaveAttribute(
      "href",
      "/gardens"
    );

    fireEvent.click(reloadButton());
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("reloads the site once, with no error shown, for a page from an older build", async () => {
    site(
      "/impact",
      byId(CLIENT_ROUTE_IDS.publicImpact),
      new TypeError("Failed to fetch dynamically imported module: /assets/chunk-old.js")
    );

    await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1));
    expect(framesUp()).toEqual(SITE_FRAME);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("draws a failed reporting page as the app draws, inside the same frame", async () => {
    site("/agent/reporting/permissions", byId(CLIENT_ROUTE_IDS.publicReportingPermissions));

    expect(
      await screen.findByRole("heading", { level: 1, name: "This screen didn't load" })
    ).toBeInTheDocument();
    expect(framesUp()).toEqual(SITE_FRAME);
    expect(screen.queryByRole("link", { name: "Browse Gardens" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("leaves one card and nothing around it when the site's own frame fails", async () => {
    site("/impact", byId(CLIENT_ROUTE_IDS.publicShell));

    expect(
      await screen.findByRole("heading", { level: 1, name: "This page could not be loaded" })
    ).toBeInTheDocument();
    expect(framesUp()).toEqual([]);
    // The card has one act. Navigation it cannot vouch for is not offered.
    expect(screen.queryByRole("link", { name: "Browse Gardens" })).not.toBeInTheDocument();
    expect(reloadButton()).toBeInTheDocument();
  });

  it("replaces an app screen inside the shell, where the bottom bar is the way out", async () => {
    app("/home/profile", byId(CLIENT_ROUTE_IDS.profile));

    expect(
      await screen.findByRole("heading", { level: 1, name: "This screen didn't load" })
    ).toBeInTheDocument();
    expect(framesUp()).toEqual(APP_FRAME);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("gives a garden's page, which hides the bottom bar, a Back that reaches Home", async () => {
    const router = app(`/home/${GARDEN}/work/7`, byPath("work/:workId"));

    const back = await screen.findByRole("button", { name: "Back" });
    // The failure took Home and the garden's pages with it, and left the shell.
    expect(framesUp()).toEqual(APP_FRAME);

    fireEvent.click(back);

    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
    await waitFor(() => expect(framesUp()).toEqual([...APP_FRAME, CLIENT_ROUTE_IDS.home]));
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it.each([
    ["the shell", "/home/profile", byId(CLIENT_ROUTE_IDS.appShell)],
    ["the session gate", "/home/profile", byId(CLIENT_ROUTE_IDS.sessionGate)],
    ["sign-in", "/home/login", byId(CLIENT_ROUTE_IDS.login)],
  ])("shows the could-not-open screen, with nothing around it, when %s fails", async (_name, path, failing) => {
    app(path, failing);

    expect(await screen.findByRole("alert")).toHaveTextContent("Green Goods couldn't open.");
    expect(framesUp()).toEqual([]);
    expect(reloadButton()).toBeInTheDocument();
  });
});
