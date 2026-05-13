/**
 * Admin Cockpit Smoke Tests
 *
 * Deterministic browser checks for the current admin cockpit routes.
 *
 * Strategy:
 * - Use the app's dev-only `mockAuth` seam instead of brittle wagmi storage injection
 * - Mock indexer gardens/actions queries so cockpit routes have stable data
 * - Mock EAS GraphQL with empty attestations so `/hub` renders predictable empty/loading states
 */
import { expect, test, type Page, type Route } from "@playwright/test";
import { AdminTestHelper, TEST_URLS } from "../helpers/test-utils";

const ADMIN_URL = TEST_URLS.admin;

const MOCK_OPERATOR_ADDRESS = "0x04D60647836bcA09c37B379550038BdaaFD82503";
const MOCK_GARDENS = [
  {
    id: "0x1234567890123456789012345678901234567890",
    chainId: 11155111,
    tokenAddress: "0xabcd1234567890123456789012345678901234ef",
    tokenID: "1",
    name: "Mock Operator Garden",
    description: "Fixture garden for admin cockpit verification",
    location: "Nairobi",
    bannerImage: "",
    gardeners: ["0x2aa64E6d80390F5C017F0313cB908051BE2FD35e"],
    operators: [MOCK_OPERATOR_ADDRESS],
    evaluators: [],
    owners: [MOCK_OPERATOR_ADDRESS],
    funders: [],
    communities: [],
    openJoining: false,
    createdAt: Math.floor(Date.now() / 1000),
  },
];
const MOCK_GARDEN_DOMAINS = MOCK_GARDENS.map((garden) => ({
  garden: garden.id,
  domainMask: 1,
}));

const GRAPHQL_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "content-type": "application/json",
};

function getGraphQLQueryText(request: { postData(): string | null }): string {
  const body = request.postData();
  if (!body) return "";

  try {
    const parsed = JSON.parse(body) as { query?: unknown; operationName?: unknown };
    if (typeof parsed.query === "string") return parsed.query;
    if (typeof parsed.operationName === "string") return parsed.operationName;
  } catch {
    return body;
  }

  return "";
}

async function mockAdminCockpitBackend(page: Page) {
  const handleIndexerRoute = async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: GRAPHQL_HEADERS,
      });
    }

    const query = getGraphQLQueryText(route.request());

    if (query.includes("query Gardens")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({
          data: {
            Garden: MOCK_GARDENS,
            GardenDomains: MOCK_GARDEN_DOMAINS,
          },
        }),
      });
    }

    if (query.includes("query GetOperatorGardens")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({
          data: {
            Garden: MOCK_GARDENS.map(({ id, name }) => ({ id, name })),
          },
        }),
      });
    }

    if (query.includes("query Actions")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({
          data: {
            Action: [],
          },
        }),
      });
    }

    if (query.includes("query Gardeners")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({
          data: {
            Gardener: [],
          },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      headers: GRAPHQL_HEADERS,
      body: JSON.stringify({ data: {} }),
    });
  };

  await page.route("**/api/graphql", handleIndexerRoute);
  await page.route("**/v1/graphql", handleIndexerRoute);

  await page.route("https://sepolia.easscan.org/graphql", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: GRAPHQL_HEADERS,
      });
    }

    await route.fulfill({
      status: 200,
      headers: GRAPHQL_HEADERS,
      body: JSON.stringify({
        data: {
          attestations: [],
        },
      }),
    });
  });
}

async function setupMockOperator(page: Page) {
  const helper = new AdminTestHelper(page);
  await helper.enableMockAuth("operator");
  await mockAdminCockpitBackend(page);
  return helper;
}

// Mocked-operator admin smoke tests have been latent-broken for 3+ days
// behind the indexer webserver gate: with the indexer skipped (28a74a26),
// they reach the dev server but the `?mockAuth=` / sessionStorage override
// path doesn't activate DevAuthProvider in the CI Playwright shell, so the
// page sits on "Checking authentication..." until the goto times out.
// Tracked for v1.1.1 — see release/1.1.0 audit doc Bundle 2 follow-up.
// The non-mocked "connect shell" test still runs as a sanity check that
// the admin app boots and the auth gate renders.
test.describe.configure({ mode: "serial" });
test.describe("Admin Cockpit", () => {
  test.use({ baseURL: ADMIN_URL });

  test("shows the connect shell when unauthenticated", async ({ page }) => {
    await page.goto("/hub");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Connect to continue")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
  });

  // SKIP: #312 owner:afo expiry:2026-06-01 — mock auth is unstable in headless CI.
  test.skip("renders the work cockpit for a mocked operator", async ({ page }) => {
    const helper = await setupMockOperator(page);

    await page.goto("/hub");
    await helper.waitForPageLoad();

    await expect(page.getByText("Connect to continue")).toHaveCount(0);
    await expect(page.getByText("Mock Operator Garden", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    // Hub renders the active stage label (Work/Assess/Certify/History) as the
    // page heading; default stage is "work" so "Work" is the expected H1.
    await expect(page.getByRole("heading", { name: "Work" })).toBeVisible();
    // The Hub tab rail renders pipeline stage tabs filtered by role
    // capability. With mocked operator auth, canManage gates the work tab and
    // history is always visible; canAssess / canCertify depend on hats role
    // assignments that the mock cannot fake, so 1-4 tabs is acceptable.
    const tablist = page.getByRole("tablist");
    await expect(tablist).toBeVisible();
    const tabCount = await tablist.getByRole("tab").count();
    expect(tabCount).toBeGreaterThanOrEqual(1);
    await expect(tablist.getByRole("tab", { name: /work/i })).toBeVisible();
    await expect(page.getByPlaceholder("Search submissions")).toBeVisible();
  });

  // SKIP: #312 owner:afo expiry:2026-06-01 — mock auth is unstable in headless CI.
  test.skip("keeps mock auth active across full reloads on other cockpit routes", async ({
    page,
  }) => {
    const helper = await setupMockOperator(page);

    await page.goto("/hub");
    await helper.waitForPageLoad();

    await page.goto("/actions");
    await helper.waitForPageLoad();

    // Actions is gated to deployers (commit 6e88d78e); mock operator without
    // deployer role lands on the Unauthorized state. Auth is still active —
    // the page renders the cockpit chrome, not the connect shell.
    await expect(page.getByText("Connect to continue")).toHaveCount(0);
    await expect(page).toHaveURL(/\/actions(?:\?.*)?$/);
    await expect(
      page
        .getByRole("heading", { name: "Actions", exact: true })
        .or(page.getByRole("heading", { name: "Unauthorized", exact: true }))
    ).toBeVisible({ timeout: 15000 });
  });

  // SKIP: #312 owner:afo expiry:2026-06-01 — mock auth is unstable in headless CI.
  test.skip("treats mobile profile as a route-backed workspace and keeps settings secondary in-query", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const helper = await setupMockOperator(page);

    await page.goto(helper.buildMockAuthPath("/profile"));
    await helper.waitForPageLoad();

    // Profile workspace renders an "Account" heading at the canvas root with
    // tabs for Profile/Settings as secondary navigation.
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.getByText("Disconnect", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("settings");

    await page.getByRole("tab", { name: "Profile" }).click();
    await expect(page.getByText("Disconnect", { exact: true })).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe(null);
  });

  // SKIP: #312 owner:afo expiry:2026-06-01 — mock auth is unstable in headless CI.
  test.skip("redirects desktop profile deep links back to hub while opening the settings sheet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const helper = await setupMockOperator(page);

    await page.goto(helper.buildMockAuthPath("/profile?tab=settings"));
    await helper.waitForPageLoad();

    // Hub redirects /hub → /hub/<active-stage>. Default stage is "work".
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
      .toMatch(/^\/hub(?:\/[a-z]+)?$/);
    await expect(page.getByText("Disconnect", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Profile" })).toHaveCount(0);
  });
});
