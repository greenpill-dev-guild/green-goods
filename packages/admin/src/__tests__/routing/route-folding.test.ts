/**
 * Route Folding Tests
 *
 * Static file analysis verifying that routes have been folded into canvas surfaces:
 *   stable Hub/Garden/Community modes are path-based
 *   focused tasks stay namespaced under the owning surface
 *   no top-level legacy route families remain
 *
 * Pattern: readFileSync + string assertions (same as surface-classes.test.ts).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname, "../../");
const routerPath = resolve(srcDir, "router.tsx");
const routeViewsPath = resolve(srcDir, "routes/views.tsx");
const workViewPath = resolve(srcDir, "views/Hub/index.tsx");
const hubControllerPath = resolve(
  srcDir,
  "../../shared/src/hooks/admin-ui/hub/useHubWorkbenchController.ts"
);
const hubSheetDescriptorPath = resolve(srcDir, "views/Hub/components/HubSheetDescriptor.tsx");
const sheetRegistryPath = resolve(
  srcDir,
  "../../shared/src/hooks/admin-ui/navigation/sheetRegistry.ts"
);
const communityViewPath = resolve(srcDir, "views/Community/index.tsx");
const profileViewPath = resolve(srcDir, "views/Profile/index.tsx");
const canvasLayoutPath = resolve(srcDir, "components/Layout/CanvasLayout.tsx");
const rightSheetDescriptorPath = resolve(
  srcDir,
  "../../shared/src/hooks/admin-ui/layout/useAdminRightSheetDescriptor.tsx"
);
const sharedAdminRoutesPath = resolve(srcDir, "../../shared/src/utils/navigation/admin-routes.ts");

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("route folding", () => {
  it("router has no top-level /assessments path (folded into /hub)", () => {
    const router = readSource(routerPath);

    // The router should NOT have a separate /assessments route at the top level.
    // Assessment functionality now lives under /hub/assess.
    // Current router still has: { path: "assessments", element: <AssessmentsRedirect /> }
    // After folding, there should be no "assessments" path definition at all —
    // only legacy redirects referencing the string.
    const pathDefinitions = router.match(/path:\s*["']assessments["']/g) ?? [];
    // After folding, we expect exactly 0 top-level /assessments path definitions
    // (the redirect is removed; folded into the /hub view)
    expect(pathDefinitions.length).toBe(0);
  });

  it("Work view file references assessment handling", () => {
    const workView = readSource(workViewPath);

    // After folding, the Work view should handle assessment display
    // via a view mode (e.g., ?view=assessments) or tab
    expect(workView).toMatch(/assessment/i);
  });

  it("Hub deep links resolve through the same Work controller", () => {
    const routeViews = readSource(routeViewsPath);
    const hubRouteBlock =
      routeViews.match(/path:\s*"hub"[\s\S]*?(?=\n\s*\{\s*path:\s*"garden")/)?.[0] ?? "";

    expect(hubRouteBlock).toContain('path: "work"');
    expect(hubRouteBlock).toContain('path: ":workId"');
    expect(hubRouteBlock).toContain('path: "submit"');
    expect(hubRouteBlock).toContain('path: "assess"');
    expect(hubRouteBlock).toContain('path: "certify"');
    expect(hubRouteBlock).toContain('path: "history"');
    expect(hubRouteBlock).toContain('path: ":historyEventId"');
    expect(routeViews).toContain('const hubView = lazyView(() => import("@/views/Hub"));');
    expect(hubRouteBlock.match(/lazy:\s*hubView/g)?.length).toBeGreaterThanOrEqual(5);
    expect(hubRouteBlock).not.toMatch(/WorkDetail/);
    expect(hubRouteBlock).not.toMatch(/SubmitWork/);
  });

  it("Work view owns the bounded Hub detail and submit panels", () => {
    // Panels are composed in the Hub sheet descriptor; content-id constants live with route helpers.
    const hubSheetDescriptor = readSource(hubSheetDescriptorPath);
    const sheetRegistry = readSource(sheetRegistryPath);

    expect(hubSheetDescriptor).toContain("WorkDetailPanel");
    expect(hubSheetDescriptor).toContain("SubmitWorkPanel");
    expect(sheetRegistry).toContain("hub:submit-work");
    expect(sheetRegistry).toContain("hub:work-detail:");
    expect(sheetRegistry).toContain("hub:history:");
    expect(sheetRegistry).toContain("ADMIN_ROUTE_SHEET_REGISTRY");
  });

  it("global right sheet content is resolved through the admin sheet registry", () => {
    const sheetRegistry = readSource(sheetRegistryPath);
    const canvasLayout = readSource(canvasLayoutPath);
    const rightSheetDescriptor = readSource(rightSheetDescriptorPath);

    expect(sheetRegistry).toContain("ADMIN_RIGHT_SHEET_REGISTRY");
    expect(sheetRegistry).toContain("notifications");
    expect(canvasLayout).toContain("useAdminRightSheetDescriptor");
    expect(canvasLayout).not.toContain("RIGHT_SHEET_TITLES");
    expect(canvasLayout).toContain("AccountSurface");
    expect(rightSheetDescriptor).toContain("NotificationPanel");
  });

  it("Hub canonical builders preserve only garden and sort context", () => {
    const adminRoutesSource = readSource(sharedAdminRoutesPath);
    const contextBlock =
      adminRoutesSource.match(/export interface AdminHubRouteContext \{([\s\S]*?)\n\}/)?.[1] ?? "";

    expect(contextBlock).toContain("gardenAddress?: Address | string;");
    expect(contextBlock).toContain("sort?: AdminHubSort;");
    expect(contextBlock).not.toContain("item?: string;");
    expect(adminRoutesSource).toContain("hubMode(mode: AdminHubMode");
    expect(adminRoutesSource).toContain("return this.hubWork(context);");
    expect(adminRoutesSource).toContain(
      "return buildAdminHref(`/hub/work/${encodeSegment(workId)}`, buildHubContextSearch(context));"
    );
    expect(adminRoutesSource).toContain(
      'return buildAdminHref("/hub/work/submit", buildHubContextSearch(context));'
    );
    expect(adminRoutesSource).toContain("hubHistoryDetail(eventId: string");
    expect(adminRoutesSource).toContain("`/hub/history/${encodeSegment(eventId)}`");
  });

  it("Hub history row inspectors are route-backed instead of transient sheet opens", () => {
    const hubController = readSource(hubControllerPath);

    expect(hubController).toContain("historyEventId: routedHistoryEventIdParam");
    expect(hubController).toContain(
      "navigate(adminRoutes.hubWorkDetail(event.itemId, hubContext));"
    );
    expect(hubController).toContain(
      "navigate(adminRoutes.hubHistoryDetail(event.id, hubContext));"
    );
    expect(hubController).not.toContain('openSheet("left", toHistoryContentId(event.id))');
    expect(hubController).toContain(
      "navigate(adminRoutes.hubHistory(hubContext), { replace: true });"
    );
  });

  it("router has no top-level /endowments path (folded into /community)", () => {
    const router = readSource(routerPath);

    // The router should NOT have a separate /endowments route.
    // Treasury functionality should be accessible via /community/treasury.
    const pathDefinitions = router.match(/path:\s*["']endowments["']/g) ?? [];
    expect(pathDefinitions.length).toBe(0);
  });

  it("Community/Treasury component imports endowment hooks", () => {
    const communityView = readSource(communityViewPath);

    // After folding, the Community view should handle endowment/treasury
    // display inline. It should reference endowment-related imports or logic.
    // This verifies the fold happened — endowment UI is within Community.
    expect(communityView).toMatch(/endowment|treasury|vault/i);
  });

  it("router exposes strategies only as a /community nested route", () => {
    const routeViews = readSource(routeViewsPath);

    // Strategy display belongs to Community/Governance.
    expect(routeViews).toMatch(/path:\s*["']community["']/);
    expect(routeViews).toMatch(/path:\s*["']governance["']/);
    expect(routeViews).toMatch(/path:\s*["']strategies["']/);
    expect(routeViews).not.toMatch(/path:\s*["']gardens["']/);
  });

  it("Garden and Community task routes resolve through their owning surface controllers", () => {
    const routeViews = readSource(routeViewsPath);
    const gardenBlock =
      routeViews.match(/path:\s*"garden"[\s\S]*?(?=\n\s*\{\s*path:\s*"community")/)?.[0] ?? "";
    const communityBlock =
      routeViews.match(/path:\s*"community"[\s\S]*?(?=\n\s*\{\s*path:\s*"actions")/)?.[0] ?? "";

    expect(gardenBlock).toContain('path: "hypercerts/:hypercertId"');
    expect(routeViews).toContain('const gardenView = lazyView(() => import("@/views/Garden"));');
    expect(gardenBlock).toContain("lazy: gardenView");
    expect(gardenBlock).not.toContain('import("@/views/Gardens/Garden/HypercertDetail")');

    expect(communityBlock).toContain('path: "vault"');
    expect(communityBlock).toContain('path: "strategies"');
    expect(communityBlock).toContain('path: "signal-pool/:poolType"');
    expect(routeViews).toContain(
      'const communityView = lazyView(() => import("@/views/Community"));'
    );
    expect(communityBlock.match(/lazy:\s*communityView/g)?.length).toBeGreaterThanOrEqual(4);
    expect(communityBlock).not.toContain('import("@/views/Gardens/Garden/Vault")');
    expect(communityBlock).not.toContain('import("@/views/Gardens/Garden/Strategies")');
    expect(communityBlock).not.toContain('import("@/views/Gardens/Garden/SignalPool")');
  });

  it("router exposes a /profile route for the mobile account workspace", () => {
    const routeViews = readSource(routeViewsPath);

    const pathDefinitions = routeViews.match(/path:\s*["']profile["']/g) ?? [];
    expect(pathDefinitions.length).toBe(1);
  });

  it("profile page source exists for the route-backed mobile account workspace", () => {
    expect(existsSync(profileViewPath)).toBe(true);
  });
});
