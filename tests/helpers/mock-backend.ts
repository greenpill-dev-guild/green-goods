import type { BrowserContext, Page, Route } from "@playwright/test";

export const MOCK_CLIENT_USER_ADDRESS = "0x1234567890123456789012345678901234567890";
export const MOCK_RPC_OWNER_ADDRESS = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e";

const GRAPHQL_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "content-type": "application/json",
};

const NOW_SECONDS = Math.floor(Date.now() / 1000);

export const MOCK_CLIENT_GARDEN = {
  id: "0x1234567890abcdef1234567890abcdef12345678",
  chainId: 11155111,
  tokenAddress: "0x1234567890abcdef1234567890abcdef12345678",
  tokenID: "1",
  name: "Test Community Garden",
  description: "A test garden for CI",
  location: "Nairobi",
  bannerImage: "",
  gardeners: [MOCK_CLIENT_USER_ADDRESS],
  operators: [],
  evaluators: [],
  owners: [],
  funders: [],
  communities: [],
  openJoining: false,
  createdAt: NOW_SECONDS - 86_400,
};

export const MOCK_CLIENT_ACTION = {
  id: "11155111-1",
  chainId: 11155111,
  title: "Plant Trees",
  slug: "agro.planting_event",
  startTime: NOW_SECONDS - 86_400,
  endTime: NOW_SECONDS + 86_400 * 30,
  instructions: null,
  capitals: [],
  media: [],
  domain: "AGRO",
  createdAt: NOW_SECONDS - 86_400,
};

export type JsonRpcPayload = {
  id?: string | number | null;
  method?: string;
  params?: Array<{ data?: string } | string | number | boolean | null>;
};

export function encodeAddressResult(address: string) {
  return `0x${address.replace(/^0x/, "").padStart(64, "0")}`;
}

/**
 * Return the smallest successful RPC response needed by CI route mocks.
 * Kept shared so client and admin do not drift around contract-read fixtures.
 */
export function buildRpcResponse(
  payload: JsonRpcPayload,
  ownerAddress: string = MOCK_RPC_OWNER_ADDRESS
) {
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
    result = encodeAddressResult(ownerAddress);
  } else if (method === "eth_call") {
    result = "0x0000000000000000000000000000000000000000000000000000000000000001";
  }

  return {
    jsonrpc: "2.0",
    id: payload.id ?? 1,
    result,
  };
}

/**
 * Mock the Sepolia JSON-RPC boundary used by deterministic browser tests.
 *
 * Admin role resolution reads DeploymentRegistry before the cockpit becomes
 * ready. Leaving that request on the public Alchemy demo endpoint makes CI
 * depend on external latency and can hold the loading state until the test
 * timeout. Keep the route shared so every clean-room browser fixture returns
 * the same contract-read responses.
 */
export async function mockSepoliaRpc(target: BrowserContext | Page) {
  await target.route("https://eth-sepolia.g.alchemy.com/**", async (route) => {
    const rawBody = route.request().postData();
    const payload = rawBody
      ? (JSON.parse(rawBody) as JsonRpcPayload | JsonRpcPayload[])
      : { id: 1 };
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

export interface MockClientBackendOptions {
  garden?: typeof MOCK_CLIENT_GARDEN;
  action?: typeof MOCK_CLIENT_ACTION;
}

/**
 * Install schema-correct client data routes before navigation. Both GraphQL
 * paths are required because local HTTP and HTTPS proxy modes resolve the
 * indexer URL differently.
 */
export async function mockClientBackend(page: Page, options: MockClientBackendOptions = {}) {
  const garden = options.garden ?? MOCK_CLIENT_GARDEN;
  const action = options.action ?? MOCK_CLIENT_ACTION;

  const handleIndexerRoute = async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: GRAPHQL_HEADERS });
    }

    const query = getGraphQLQueryText(route);
    if (query.includes("query Gardens")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({
          data: {
            Garden: [garden],
            GardenDomains: [{ garden: garden.id, domainMask: 2 }],
          },
        }),
      });
    }

    if (query.includes("Action")) {
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({ data: { Action: [action] } }),
      });
    }

    return route.fulfill({
      status: 200,
      headers: GRAPHQL_HEADERS,
      body: JSON.stringify({ data: {} }),
    });
  };

  await page.route("**/v1/graphql", handleIndexerRoute);
  await page.route("**/api/graphql", handleIndexerRoute);

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

  await mockSepoliaRpc(page);
}
