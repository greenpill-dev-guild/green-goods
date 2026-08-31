import { describe, expect, it } from "vitest";
import type { RouteObject } from "react-router-dom";
import { CLIENT_ROUTE_IDS, publicAppRoutes, pwaAppRoutes } from "../../config/routes";

function collectRouteIds(routes: RouteObject[]): string[] {
  return routes
    .flatMap((route) => [route.id, ...collectRouteIds(route.children ?? [])])
    .filter((id): id is string => Boolean(id));
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
});
