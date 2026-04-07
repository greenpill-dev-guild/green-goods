/**
 * Route Folding Tests
 *
 * RED phase — static file analysis verifying that routes have been
 * folded into cockpit surfaces:
 *   /assessments -> folded into /work
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

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("route folding", () => {
  it("router has no top-level /assessments path (folded into /work)", () => {
    const router = readSource(routerPath);

    // The router should NOT have a separate /assessments route at the top level.
    // Assessment functionality should be accessible via /work?view=assessments.
    // Current router still has: { path: "assessments", element: <AssessmentsRedirect /> }
    // After folding, there should be no "assessments" path definition at all —
    // only legacy redirects referencing the string.
    const pathDefinitions = router.match(/path:\s*["']assessments["']/g) ?? [];
    // After folding, we expect exactly 0 top-level /assessments path definitions
    // (the redirect is removed; folded into the /work view)
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

  it("router has no top-level /strategies path (folded into /community)", () => {
    const router = readSource(routerPath);

    // The router should NOT have a separate /strategies route.
    // Strategy display should be within /community.
    // Current router has: gardens/:id/strategies as a secondary route.
    // After folding, there should be no standalone /strategies path.
    const topLevelStrategies = router.match(/^\s*\{\s*path:\s*["']strategies["']/gm) ?? [];
    expect(topLevelStrategies.length).toBe(0);
  });
});
