/**
 * Route Folding Tests
 *
 * RED phase — static file analysis verifying that routes have been
 * folded into canvas surfaces:
 *   stable Hub/Garden/Community modes are path-based
 *   focused tasks stay namespaced under the owning surface
 *   no top-level legacy route families remain
 *
 * These tests WILL FAIL because route folding hasn't been implemented yet.
 * Pattern: readFileSync + string assertions (same as surface-classes.test.ts).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname, "../../");
const routerPath = resolve(srcDir, "router.tsx");
const workViewPath = resolve(srcDir, "views/Hub/index.tsx");
const communityViewPath = resolve(srcDir, "views/Community/index.tsx");
const profileViewPath = resolve(srcDir, "views/Profile/index.tsx");
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
    const router = readSource(routerPath);
    const hubRouteBlock =
      router.match(/path:\s*"hub"[\s\S]*?(?=\n\s*\{\s*path:\s*"garden")/)?.[0] ?? "";

    expect(hubRouteBlock).toContain('path: "work"');
    expect(hubRouteBlock).toContain('path: ":workId"');
    expect(hubRouteBlock).toContain('path: "submit"');
    expect(hubRouteBlock).toContain('path: "assess"');
    expect(hubRouteBlock).toContain('path: "certify"');
    expect(hubRouteBlock).toContain('path: "history"');
    expect(hubRouteBlock.match(/import\("@\/views\/Hub"\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(hubRouteBlock).not.toMatch(/WorkDetail/);
    expect(hubRouteBlock).not.toMatch(/SubmitWork/);
  });

  it("Work view owns the bounded Hub detail and submit panels", () => {
    const workView = readSource(workViewPath);

    expect(workView).toContain("WorkDetailPanel");
    expect(workView).toContain("SubmitWorkPanel");
    expect(workView).toContain("hub:submit-work");
    expect(workView).toContain("hub:work-detail:");
  });

  it("Hub canonical builders preserve only garden, sort, and item context", () => {
    const adminRoutesSource = readSource(sharedAdminRoutesPath);
    const contextBlock =
      adminRoutesSource.match(/export interface AdminHubRouteContext \{([\s\S]*?)\n\}/)?.[1] ?? "";

    expect(contextBlock).toContain("gardenAddress?: Address | string;");
    expect(contextBlock).toContain("sort?: AdminHubSort;");
    expect(contextBlock).toContain("item?: string;");
    expect(adminRoutesSource).toContain("hubMode(mode: AdminHubMode");
    expect(adminRoutesSource).toContain("return this.hubWork(context);");
    expect(adminRoutesSource).toContain(
      "return buildAdminHref(`/hub/work/${encodeSegment(workId)}`, buildHubContextSearch(context));"
    );
    expect(adminRoutesSource).toContain(
      'return buildAdminHref("/hub/work/submit", buildHubContextSearch(context));'
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
    const router = readSource(routerPath);

    // Strategy display belongs to Community/Governance.
    expect(router).toMatch(/path:\s*["']community["']/);
    expect(router).toMatch(/path:\s*["']governance["']/);
    expect(router).toMatch(/path:\s*["']strategies["']/);
    expect(router).not.toMatch(/path:\s*["']gardens["']/);
  });

  it("Garden and Community task routes resolve through their owning surface controllers", () => {
    const router = readSource(routerPath);
    const gardenBlock =
      router.match(/path:\s*"garden"[\s\S]*?(?=\n\s*\{\s*path:\s*"community")/)?.[0] ?? "";
    const communityBlock =
      router.match(/path:\s*"community"[\s\S]*?(?=\n\s*\/\/ ── Actions canvas surface)/)?.[0] ?? "";

    expect(gardenBlock).toContain('path: "hypercerts/:hypercertId"');
    expect(gardenBlock).toContain('import("@/views/Garden")');
    expect(gardenBlock).not.toContain('import("@/views/Gardens/Garden/HypercertDetail")');

    expect(communityBlock).toContain('path: "vault"');
    expect(communityBlock).toContain('path: "strategies"');
    expect(communityBlock).toContain('path: "signal-pool/:poolType"');
    expect(communityBlock.match(/import\("@\/views\/Community"\)/g)?.length).toBeGreaterThanOrEqual(
      4
    );
    expect(communityBlock).not.toContain('import("@/views/Gardens/Garden/Vault")');
    expect(communityBlock).not.toContain('import("@/views/Gardens/Garden/Strategies")');
    expect(communityBlock).not.toContain('import("@/views/Gardens/Garden/SignalPool")');
  });

  it("router exposes a /profile route for the mobile account workspace", () => {
    const router = readSource(routerPath);

    const pathDefinitions = router.match(/path:\s*["']profile["']/g) ?? [];
    expect(pathDefinitions.length).toBe(1);
  });

  it("profile page source exists for the route-backed mobile account workspace", () => {
    expect(existsSync(profileViewPath)).toBe(true);
  });
});
