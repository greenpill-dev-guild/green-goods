import { describe, expect, it } from "vitest";
import type { Page, Route } from "@playwright/test";
import { decodeAbiParameters, encodeFunctionData, parseAbi } from "viem";
import { MOCK_CLIENT_GARDEN, mockClientBackend, mockSepoliaRpc } from "../helpers/mock-backend";
import deployment from "../../packages/contracts/deployments/11155111-latest.json" with {
  type: "json",
};

function transport() {
  const routes = new Map<unknown, (route: Route) => Promise<unknown>>();
  const page = {
    route: async (matcher: unknown, handler: (route: Route) => Promise<unknown>) => {
      routes.set(matcher, handler);
    },
  } as unknown as Page;
  return {
    page,
    async request(body: unknown, endpoint: "indexer" | "rpc" | "eas" = "indexer") {
      const handler =
        endpoint === "rpc"
          ? [...routes.entries()].find(([key]) => typeof key === "function")?.[1]
          : routes.get(
              endpoint === "eas" ? "https://sepolia.easscan.org/graphql" : "**/v1/graphql"
            );
      let response: { body?: string } = {};
      await handler?.({
        request: () => ({
          method: () => "POST",
          postData: () => JSON.stringify(body),
          url: () => "https://fixture.test",
        }),
        fulfill: async (value: typeof response) => {
          response = value;
        },
      } as unknown as Route);
      return JSON.parse(response.body ?? "null");
    },
  };
}

const gardens = {
  query: "query Gardens($chainId: Int!) { Garden { id } GardenDomains { garden domainMask } }",
  variables: { chainId: 11155111 },
};

describe("browser backend contract", () => {
  it("rejects unknown operations, including names merely containing Action", async () => {
    const mock = transport();
    await mockClientBackend(mock.page);
    await expect(mock.request({ query: "query UnknownAction { Action { id } }" })).rejects.toThrow(
      /Unsupported.*UnknownAction/
    );
  });
  it("rejects the wrong chain instead of returning fixture gardens", async () => {
    const mock = transport();
    await mockClientBackend(mock.page);
    await expect(mock.request({ ...gardens, variables: { chainId: 42161 } })).rejects.toThrow(
      /chainId/
    );
  });
  it("requires declared requests and counts supported requests", async () => {
    const mock = transport();
    const backend = await mockClientBackend(mock.page, { required: ["indexer: Gardens"] });
    expect(() => backend.assertSatisfied()).toThrow(/Missing.*Gardens/);
    expect((await mock.request(gardens)).data.Garden).toHaveLength(1);
    expect(() => backend.assertSatisfied()).not.toThrow();
  });
  it("keeps a legitimate empty gardener page explicit", async () => {
    const mock = transport();
    await mockClientBackend(mock.page);
    expect(
      await mock.request({
        query: "query Gardeners($chainId: Int!, $limit: Int!, $offset: Int!) { Gardener { id } }",
        variables: { chainId: 11155111, limit: 200, offset: 0 },
      })
    ).toEqual({ data: { Gardener: [] } });
  });
  it("rejects an EAS query for the wrong schema or recipient, even with empty results", async () => {
    const mock = transport();
    await mockClientBackend(mock.page);
    const where = {
      schemaId: { equals: deployment.schemas.workSchemaUID },
      recipient: { equals: MOCK_CLIENT_GARDEN.id },
      revoked: { equals: false },
    };
    const query =
      "query WorkListPage($where: AttestationWhereInput) { attestations(where: $where) { id } }";
    expect(await mock.request({ query, variables: { where } }, "eas")).toEqual({
      data: { attestations: [] },
    });
    for (const invalid of [
      { ...where, schemaId: { equals: "0xwrong" } },
      { ...where, recipient: { equals: "0x0000000000000000000000000000000000000001" } },
    ]) {
      await expect(mock.request({ query, variables: { where: invalid } }, "eas")).rejects.toThrow(
        /schemaId|address/
      );
    }
  });
  it("allows only known RPC methods and exact contract calls", async () => {
    const mock = transport();
    await mockSepoliaRpc(mock.page);
    for (const payload of [
      { method: "eth_sendRawTransaction", params: ["0x"] },
      {
        method: "eth_call",
        params: [{ to: deployment.deploymentRegistry, data: "0xdeadbeef" }, "latest"],
      },
      {
        method: "eth_call",
        params: [
          { to: "0x1234567890123456789012345678901234567890", data: "0x8da5cb5b" },
          "latest",
        ],
      },
    ])
      await expect(mock.request({ jsonrpc: "2.0", id: 1, ...payload }, "rpc")).rejects.toThrow(
        /Unsupported/
      );
    expect(await mock.request({ id: 7, method: "eth_chainId", params: [] }, "rpc")).toEqual({
      jsonrpc: "2.0",
      id: 7,
      result: "0xaa36a7",
    });
    expect(
      (
        await mock.request(
          {
            id: 8,
            method: "eth_call",
            params: [{ to: deployment.deploymentRegistry, data: "0x8da5cb5b" }, "latest"],
          },
          "rpc"
        )
      ).result
    ).toMatch(/^0x0{24}/);
  });
  it("derives evaluator permission from the garden and rejects an unknown batched read", async () => {
    const mock = transport();
    const steward = "0x04D60647836bcA09c37B379550038BdaaFD82503";
    await mockSepoliaRpc(mock.page, { garden: { ...MOCK_CLIENT_GARDEN, operators: [steward] } });
    const abi = parseAbi(["function isEvaluator(address) view returns (bool)"]);
    for (const [address, allowed] of [
      [MOCK_CLIENT_GARDEN.gardeners[0], false],
      [steward, true],
    ] as const) {
      const response = await mock.request(
        {
          method: "eth_call",
          params: [
            {
              to: MOCK_CLIENT_GARDEN.id,
              data: encodeFunctionData({
                abi,
                functionName: "isEvaluator",
                args: [address as `0x${string}`],
              }),
            },
            "latest",
          ],
        },
        "rpc"
      );
      expect(decodeAbiParameters([{ type: "bool" }], response.result)).toEqual([allowed]);
    }
    const multicall = encodeFunctionData({
      abi: parseAbi([
        "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])",
      ]),
      functionName: "aggregate3",
      args: [
        [
          {
            target: MOCK_CLIENT_GARDEN.id as `0x${string}`,
            allowFailure: true,
            callData: "0xdeadbeef",
          },
        ],
      ],
    });
    await expect(
      mock.request(
        {
          method: "eth_call",
          params: [{ to: "0xca11bde05977b3631167028862be2a173976ca11", data: multicall }, "latest"],
        },
        "rpc"
      )
    ).rejects.toThrow(/Unsupported/);
  });
});
