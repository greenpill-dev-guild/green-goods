/**
 * Admin Production Flows CI Smoke Tests
 *
 * Validates that critical admin cockpit routes render without crashing:
 * - Create garden
 * - Create assessment
 * - Garden vault
 * - Mint hypercert
 *
 * These tests focus on route-level stability and are safe for CI.
 */

import { expect, test, type Page, type Route } from "@playwright/test";
import { AdminTestHelper, TEST_URLS } from "../helpers/test-utils";

const ADMIN_URL = TEST_URLS.admin;
const ROUTE_SMOKE_TEST_TIMEOUT_MS = 90_000;
const MOCK_DEPLOYER_ADDRESS = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e";
const MOCK_OPERATOR_ADDRESS = "0x04D60647836bcA09c37B379550038BdaaFD82503";
const TEST_GARDEN_ADDRESS = "0xabcd1234567890123456789012345678901234ef";
const TEST_GARDEN_ID = "0x1234567890123456789012345678901234567890";
const TEST_GARDEN_CONTEXT = `gardenAddress=${encodeURIComponent(TEST_GARDEN_ADDRESS)}`;

const GRAPHQL_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "content-type": "application/json",
};

const MOCK_GARDEN = {
  id: TEST_GARDEN_ID,
  chainId: 11155111,
  tokenAddress: TEST_GARDEN_ADDRESS,
  tokenID: "1",
  name: "Mock CI Garden",
  description: "Fixture garden for admin production-flow route smoke",
  location: "Nairobi",
  bannerImage: "",
  gardeners: [MOCK_OPERATOR_ADDRESS],
  operators: [MOCK_OPERATOR_ADDRESS, MOCK_DEPLOYER_ADDRESS],
  evaluators: [MOCK_OPERATOR_ADDRESS, MOCK_DEPLOYER_ADDRESS],
  owners: [MOCK_DEPLOYER_ADDRESS],
  funders: [],
  communities: [],
  openJoining: false,
  createdAt: 1710000000,
};

function getGraphQLQueryText(route: Route): string {
  const body = route.request().postData();
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

function encodeAddressResult(address: string) {
  return `0x${address.replace(/^0x/, "").padStart(64, "0")}`;
}

function buildRpcResponse(payload: {
  id?: string | number | null;
  method?: string;
  params?: Array<{ data?: string } | string | number | boolean | null>;
}) {
  const method = payload.method;
  const callData =
    typeof payload.params?.[0] === "object" && payload.params[0] !== null
      ? String(payload.params[0].data ?? "")
      : "";

  let result: string | null = "0x1";
  if (method === "eth_chainId") {
    result = "0xaa36a7";
  } else if (method === "eth_blockNumber") {
    result = "0x1";
  } else if (method === "eth_call" && callData.startsWith("0x8da5cb5b")) {
    result = encodeAddressResult(MOCK_DEPLOYER_ADDRESS);
  } else if (method === "eth_call") {
    result = "0x0000000000000000000000000000000000000000000000000000000000000001";
  }

  return {
    jsonrpc: "2.0",
    id: payload.id ?? 1,
    result,
  };
}

async function setupAdminRouteBackend(page: Page) {
  const handleIndexerRoute = async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: GRAPHQL_HEADERS });
    }

    const query = getGraphQLQueryText(route);

    if (query.includes("query GetOperatorGardens")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({
          data: {
            Garden: [{ id: MOCK_GARDEN.id, name: MOCK_GARDEN.name }],
          },
        }),
      });
    }

    if (query.includes("query Gardens")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({
          data: {
            Garden: [MOCK_GARDEN],
            GardenDomains: [{ garden: MOCK_GARDEN.id, domainMask: 1 }],
          },
        }),
      });
    }

    if (query.includes("query Actions")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({ data: { Action: [] } }),
      });
    }

    if (query.includes("query Gardeners")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({ data: { Gardener: [] } }),
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
      return route.fulfill({ status: 204, headers: GRAPHQL_HEADERS });
    }

    return route.fulfill({
      status: 200,
      headers: GRAPHQL_HEADERS,
      body: JSON.stringify({ data: { attestations: [] } }),
    });
  });

  await page.route("https://eth-sepolia.g.alchemy.com/**", async (route) => {
    const rawBody = route.request().postData();
    const payload = rawBody ? JSON.parse(rawBody) : { id: 1 };
    const response = Array.isArray(payload)
      ? payload.map((entry) => buildRpcResponse(entry))
      : buildRpcResponse(payload);

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

async function setupAuthenticatedAdmin(page: Page) {
  const helper = new AdminTestHelper(page);
  await setupAdminRouteBackend(page);

  return helper;
}

async function expectNoCrashOnRoute(page: Page, helper: AdminTestHelper, route: string) {
  await page.goto(helper.buildMockAuthPath(route, "deployer"), {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  const hasAppError = await page
    .locator('text="Unexpected Application Error"')
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  expect(hasAppError).toBe(false);
  expect(new URL(page.url()).origin).toBe(new URL(ADMIN_URL).origin);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15000 });
}

test.describe("Admin Production Flows CI", () => {
  test.use({ baseURL: ADMIN_URL });

  test("critical flow routes render for authenticated deployers", async ({ page }) => {
    test.setTimeout(ROUTE_SMOKE_TEST_TIMEOUT_MS);
    const helper = await setupAuthenticatedAdmin(page);

    const criticalRoutes = [
      "/garden/create",
      `/hub/assess/create?${TEST_GARDEN_CONTEXT}`,
      `/community/treasury/vault?${TEST_GARDEN_CONTEXT}`,
      `/hub/certify/create?${TEST_GARDEN_CONTEXT}`,
    ];

    for (const route of criticalRoutes) {
      await test.step(`route: ${route}`, async () => {
        await expectNoCrashOnRoute(page, helper, route);
        const currentUrl = new URL(page.url());
        const expectedUrl = new URL(route, ADMIN_URL);
        expect(currentUrl.pathname).toBe(expectedUrl.pathname);
        for (const [key, value] of expectedUrl.searchParams) {
          expect(currentUrl.searchParams.get(key)).toBe(value);
        }
      });
    }
  });
});
