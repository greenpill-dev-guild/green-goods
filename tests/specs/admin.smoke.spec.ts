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

test.describe("Admin Cockpit", () => {
  test.use({ baseURL: ADMIN_URL });

  test("shows the connect shell when unauthenticated", async ({ page }) => {
    await page.goto("/hub");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Connect to continue")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
  });

  test("renders the work cockpit for a mocked operator", async ({ page }) => {
    const helper = await setupMockOperator(page);

    await page.goto("/hub");
    await helper.waitForPageLoad();

    await expect(page.getByText("Connect to continue")).toHaveCount(0);
    await expect(page.getByText("Mock Operator Garden", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("heading", { name: "Hub" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /review/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /assess/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /certify/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /history/i })).toBeVisible();
    await expect(page.getByPlaceholder("Search submissions")).toBeVisible();
  });

  test("keeps mock auth active across full reloads on other cockpit routes", async ({ page }) => {
    const helper = await setupMockOperator(page);

    await page.goto("/hub");
    await helper.waitForPageLoad();

    await page.goto("/actions");
    await helper.waitForPageLoad();

    await expect(page.getByText("Connect to continue")).toHaveCount(0);
    await expect(page).toHaveURL(/\/actions(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Actions", exact: true })).toBeVisible({
      timeout: 15000,
    });
  });

  test("treats mobile profile as a route-backed workspace and keeps settings secondary in-query", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const helper = await setupMockOperator(page);

    await page.goto(helper.buildMockAuthPath("/profile"));
    await helper.waitForPageLoad();

    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({ timeout: 15000 });
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

  test("redirects desktop profile deep links back to hub while opening the settings sheet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const helper = await setupMockOperator(page);

    await page.goto(helper.buildMockAuthPath("/profile?tab=settings"));
    await helper.waitForPageLoad();

    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe("/hub");
    await expect(page.getByText("Disconnect", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Profile" })).toHaveCount(0);
  });
});
