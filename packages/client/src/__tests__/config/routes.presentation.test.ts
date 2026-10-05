import { describe, expect, it } from "vitest";
import type { RouteObject } from "react-router-dom";
import { CLIENT_ROUTE_IDS, publicAppRoutes, pwaAppRoutes } from "../../config/routes";

function collectRouteIds(routes: RouteObject[]): string[] {
  return routes
    .flatMap((route) => [route.id, ...collectRouteIds(route.children ?? [])])
    .filter((id): id is string => Boolean(id));
}

function findRoute(routes: RouteObject[], id: string): RouteObject | undefined {
  for (const route of routes) {
    if (route.id === id) return route;
    const found = findRoute(route.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

/** Which recovery state a route shows when it fails; undefined leaves it to the route above. */
function errorView(route: RouteObject | undefined): string | undefined {
  return (route?.errorElement as { props?: { view?: string } } | undefined)?.props?.view;
}

/** Every route in a table, depth first. */
function flatten(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((route) => [route, ...flatten(route.children ?? [])]);
}

describe("presentation route trees", () => {
  it("keeps installed routes out of the public tree", () => {
    const ids = collectRouteIds(publicAppRoutes);
    expect(ids).toContain(CLIENT_ROUTE_IDS.publicHome);
    expect(ids).not.toContain(CLIENT_ROUTE_IDS.home);
    expect(ids).not.toContain(CLIENT_ROUTE_IDS.login);
  });

  it("keeps public routes out of the installed tree", () => {
    const ids = collectRouteIds(pwaAppRoutes);
    expect(ids).toContain(CLIENT_ROUTE_IDS.home);
    expect(ids).toContain(CLIENT_ROUTE_IDS.login);
    expect(ids).not.toContain(CLIENT_ROUTE_IDS.publicHome);
  });

  it("never sets an error state on a route whose own code can fail to load", () => {
    // React Router does not render a route whose `lazy` import failed, its `errorElement`
    // included: the page would be blank. A state therefore sits on a route with no code of its
    // own, around the routes it covers. The root is the one exception the router does render.
    for (const table of [publicAppRoutes, pwaAppRoutes]) {
      const carriers = flatten(table).filter((route) => route.errorElement);
      expect(carriers.filter((route) => route.lazy).map((route) => route.id)).toEqual([
        CLIENT_ROUTE_IDS.root,
      ]);
      for (const carrier of carriers.filter((route) => route.id !== CLIENT_ROUTE_IDS.root)) {
        expect(carrier.path).toBeUndefined();
        expect(carrier.loader).toBeUndefined();
        expect(carrier.element).toBeUndefined();
      }
    }
  });

  it("fails a public page inside the site's frame, and the frame as the whole site", () => {
    const shell = findRoute(publicAppRoutes, CLIENT_ROUTE_IDS.publicShell);
    const [pages, ceremony] = shell?.children ?? [];
    const isReporting = (route: RouteObject) => route.path?.startsWith("agent/reporting/");

    // The entry decides which screen a frame's failure is: here, the website's own card.
    expect(errorView(publicAppRoutes[0])).toBe("frame");
    // The shell has no state of its own: with the header gone, only the site's can be trusted.
    expect(errorView(shell)).toBeUndefined();
    expect((shell?.children ?? []).map(errorView)).toEqual(["page", "ceremony"]);
    // The reporting pages are drawn as the app draws, so they fail as it does; nothing else does.
    expect(ceremony.children?.map((route) => isReporting(route))).toEqual([true, true, true]);
    expect(pages.children?.some(isReporting)).toBe(false);
    expect(collectRouteIds(pages.children ?? [])).toEqual(
      expect.arrayContaining([
        CLIENT_ROUTE_IDS.publicHome,
        CLIENT_ROUTE_IDS.publicGardens,
        CLIENT_ROUTE_IDS.publicGardenDetail,
        CLIENT_ROUTE_IDS.publicImpact,
        CLIENT_ROUTE_IDS.publicFund,
        CLIENT_ROUTE_IDS.publicActions,
      ])
    );
  });

  it("fails an app screen inside the shell, and everything around it as the whole app", () => {
    const shell = findRoute(pwaAppRoutes, CLIENT_ROUTE_IDS.appShell);
    const [screens] = shell?.children ?? [];

    expect(errorView(pwaAppRoutes[0])).toBe("frame");
    expect((shell?.children ?? []).map(errorView)).toEqual(["screen"]);
    expect(collectRouteIds(screens.children ?? [])).toEqual(
      expect.arrayContaining([
        CLIENT_ROUTE_IDS.home,
        CLIENT_ROUTE_IDS.garden,
        CLIENT_ROUTE_IDS.gardenSubmit,
        CLIENT_ROUTE_IDS.profile,
      ])
    );
    // Sign-in sits outside the shell, and the runtime, the session gate and the shell are the
    // frame itself: none of them has a bottom bar to keep, so each fails as the app.
    for (const id of [
      CLIENT_ROUTE_IDS.pwaRuntime,
      CLIENT_ROUTE_IDS.sessionGate,
      CLIENT_ROUTE_IDS.appShell,
      CLIENT_ROUTE_IDS.login,
    ]) {
      expect(errorView(findRoute(pwaAppRoutes, id))).toBeUndefined();
    }
    expect(collectRouteIds(screens.children ?? [])).not.toContain(CLIENT_ROUTE_IDS.login);
  });
});
