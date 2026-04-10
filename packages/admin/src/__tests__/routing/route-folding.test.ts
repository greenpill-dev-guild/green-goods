/**
 * Route Folding Tests
 *
 * RED phase — static file analysis verifying that routes have been
 * folded into cockpit surfaces:
 *   /assessments -> folded into /hub
 *   /endowments  -> folded into /community
 *   /strategies  -> folded into /community
 *
 * These tests WILL FAIL because route folding hasn't been implemented yet.
 * Pattern: readFileSync + string assertions (same as surface-classes.test.ts).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname, "../../");
const routerPath = resolve(srcDir, "router.tsx");
const workViewPath = resolve(srcDir, "views/Work/index.tsx");
const communityViewPath = resolve(srcDir, "views/Community/index.tsx");
const profileViewPath = resolve(srcDir, "views/Profile/index.tsx");

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("route folding", () => {
  it("router has no top-level /assessments path (folded into /hub)", () => {
    const router = readSource(routerPath);

    // The router should NOT have a separate /assessments route at the top level.
    // Assessment functionality should be accessible via /hub?view=assess.
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

  it("router has no top-level /endowments path (folded into /community)", () => {
    const router = readSource(routerPath);

    // The router should NOT have a separate /endowments route.
    // Endowment functionality should be accessible via /community?card=treasury.
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

    // Strategy display belongs to the Community surface.
    // We should keep the nested /community/strategies route and avoid
    // any legacy /gardens/:id/strategies route family.
    expect(router).toMatch(/path:\s*["']community["']/);
    expect(router).toMatch(/path:\s*["']strategies["']/);
    expect(router).not.toMatch(/path:\s*["']gardens["']/);
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
