import type { BrowserContext, Page, Route } from "@playwright/test";
import { Kind, parse } from "graphql";
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  encodeFunctionResult,
  parseAbi,
} from "viem";
import deployment from "../../packages/contracts/deployments/11155111-latest.json" with {
  type: "json",
};

const MOCK_CLIENT_USER_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_RPC_OWNER_ADDRESS = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e";

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
  // The indexer field keeps the deployed `operators` wire name.
  operators: [] as string[],
  evaluators: [] as string[],
  owners: [] as string[],
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
  params?: unknown[];
};

export function encodeAddressResult(address: string) {
  return `0x${address.replace(/^0x/, "").padStart(64, "0")}`;
}

const roles = [
  MOCK_CLIENT_USER_ADDRESS,
  MOCK_RPC_OWNER_ADDRESS,
  "0x04D60647836bcA09c37B379550038BdaaFD82503",
];
const registryCalls = new Set(
  roles.map((address) =>
    encodeFunctionData({
      abi: parseAbi(["function isInAllowlist(address) view returns (bool)"]),
      functionName: "isInAllowlist",
      args: [address as `0x${string}`],
    }).toLowerCase()
  )
);

const multicallAbi = parseAbi([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);
const evaluatorAbi = parseAbi(["function isEvaluator(address) view returns (bool)"]);

export interface MockRpcRead {
  name: string;
  to: string;
  from: string;
  data: `0x${string}`;
  result: `0x${string}`;
}

function buildRpcResponse(
  payload: JsonRpcPayload,
  garden: typeof MOCK_CLIENT_GARDEN,
  reads: MockRpcRead[],
  requests: Map<string, number>,
  nested = false
) {
  const addresses = [...roles, garden.id, garden.tokenAddress];
  const { method, params = [] } = payload;
  let result: string;
  if ((method === "eth_chainId" || method === "eth_blockNumber") && params.length === 0) {
    result = method === "eth_chainId" ? "0xaa36a7" : "0x1";
  } else if (method === "eth_call") {
    const call = params[0] as { to?: string; data?: string; from?: string } | undefined;
    const data = call?.data?.toLowerCase();
    if (params.length !== 2 || params[1] !== "latest" || !call?.to || !data) {
      throw new Error(`Unsupported RPC eth_call: ${JSON.stringify(params)}`);
    }
    const target = call.to.toLowerCase();
    const declaredRead = reads.find(
      (read) =>
        read.to.toLowerCase() === target &&
        read.data.toLowerCase() === data &&
        read.from.toLowerCase() === call.from?.toLowerCase()
    );
    if (declaredRead) {
      const key = `rpc: ${declaredRead.name}`;
      requests.set(key, (requests.get(key) ?? 0) + 1);
      result = declaredRead.result;
    } else if (target === "0xca11bde05977b3631167028862be2a173976ca11" && !nested) {
      const decoded = decodeFunctionData({ abi: multicallAbi, data: data as `0x${string}` });
      check(decoded.functionName === "aggregate3" && decoded.args[0].length > 0, "RPC multicall");
      const results = decoded.args[0].map((call) => ({
        success: true,
        // Unknown inner reads still fail, even when the caller allows individual failures.
        returnData: buildRpcResponse(
          { method: "eth_call", params: [{ to: call.target, data: call.callData }, "latest"] },
          garden,
          reads,
          requests,
          true
        ).result as `0x${string}`,
      }));
      result = encodeFunctionResult({
        abi: multicallAbi,
        functionName: "aggregate3",
        result: results,
      });
    } else if (target === garden.id.toLowerCase() && data.startsWith("0x1b561cf9")) {
      const {
        args: [address],
      } = decodeFunctionData({ abi: evaluatorAbi, data: data as `0x${string}` });
      check(
        roles.some((role) => role.toLowerCase() === address.toLowerCase()),
        "RPC evaluator identity"
      );
      const canEvaluate = [...garden.evaluators, ...garden.operators, ...garden.owners].some(
        (role) => role.toLowerCase() === address.toLowerCase()
      );
      result = encodeAbiParameters([{ type: "bool" }], [canEvaluate]);
    } else if (
      target === garden.id.toLowerCase() &&
      data ===
        encodeFunctionData({
          abi: parseAbi(["function token() view returns (uint256, address, uint256)"]),
          functionName: "token",
        })
    ) {
      result = encodeAbiParameters(
        [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
        [BigInt(garden.chainId), garden.tokenAddress as `0x${string}`, BigInt(garden.tokenID)]
      );
    } else if (
      target === garden.tokenAddress.toLowerCase() &&
      ["gardensModule", "hatsModule"].some(
        (name) =>
          data ===
          encodeFunctionData({
            abi: parseAbi([`function ${name}() view returns (address)`]),
            functionName: name,
          })
      )
    ) {
      // The empty-vault fixture has no governance modules wired to its token.
      result = encodeAddressResult("0x0000000000000000000000000000000000000000");
    } else if (
      target === deployment.cookieJarModule.toLowerCase() &&
      data ===
        encodeFunctionData({
          abi: parseAbi(["function getGardenJars(address) view returns (address[])"]),
          functionName: "getGardenJars",
          args: [garden.id as `0x${string}`],
        }).toLowerCase()
    ) {
      result = encodeAbiParameters([{ type: "address[]" }], [[]]);
    } else if (
      [deployment.deploymentRegistry, deployment.octantModule].some(
        (address) => address.toLowerCase() === target
      ) &&
      data === "0x8da5cb5b"
    ) {
      result = encodeAddressResult(MOCK_RPC_OWNER_ADDRESS);
    } else if (target === deployment.deploymentRegistry.toLowerCase() && registryCalls.has(data)) {
      result = encodeAbiParameters([{ type: "bool" }], [true]);
    } else if (
      target === deployment.greenGoodsENS.toLowerCase() &&
      ["0x7150ef88", "0x6130787d"].includes(data)
    ) {
      // This scenario has no protocol hat configured (HATS / protocolHatId).
      result = encodeAbiParameters([{ type: "uint256" }], [0n]);
    } else if (target === deployment.greenGoodsENS.toLowerCase() && data === "0xe224884b") {
      result = encodeAddressResult(deployment.ensReceiver);
    } else if (
      [deployment.greenGoodsENS, deployment.ensReceiver].some(
        (address) => address.toLowerCase() === target
      ) &&
      addresses.some(
        (address) =>
          encodeFunctionData({
            abi: parseAbi(["function ownerToSlug(address) view returns (string)"]),
            functionName: "ownerToSlug",
            args: [address as `0x${string}`],
          }).toLowerCase() === data
      )
    ) {
      // Known fixture identities have no ENS name on either layer.
      result = encodeAbiParameters([{ type: "string" }], [""]);
    } else {
      throw new Error(`Unsupported RPC eth_call: ${JSON.stringify(params)}`);
    }
  } else {
    throw new Error(`Unsupported RPC ${method}: ${JSON.stringify(params)}`);
  }
  return { jsonrpc: "2.0", id: payload.id ?? 1, result };
}

/** Explicit registry/profile reads only. Writes and unknown reads cannot look successful. */
export async function mockSepoliaRpc(
  target: BrowserContext | Page,
  options: {
    garden?: typeof MOCK_CLIENT_GARDEN;
    reads?: MockRpcRead[];
    requests?: Map<string, number>;
  } = {}
) {
  const garden = options.garden ?? MOCK_CLIENT_GARDEN;
  const reads = options.reads ?? [];
  const requests = options.requests ?? new Map<string, number>();
  await target.route(
    (url) =>
      url.hostname === "eth-sepolia.g.alchemy.com" ||
      url.hostname === "ethereum-sepolia.publicnode.com",
    async (route) => {
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers: GRAPHQL_HEADERS });
      const payload = JSON.parse(route.request().postData() ?? "null");
      if (!payload || (Array.isArray(payload) && payload.length === 0))
        throw new Error("Unsupported empty RPC request");
      const response = Array.isArray(payload)
        ? payload.map((request) => buildRpcResponse(request, garden, reads, requests))
        : buildRpcResponse(payload, garden, reads, requests);
      return route.fulfill({
        status: 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify(response),
      });
    }
  );
}

export interface MockAttestation {
  id: string;
  schemaId: string;
  attester: string;
  recipient: string;
  timeCreated: number;
  decodedDataJson: string;
}

export interface MockClientBackendOptions {
  garden?: typeof MOCK_CLIENT_GARDEN;
  action?: typeof MOCK_CLIENT_ACTION;
  attestations?: MockAttestation[];
  required?: string[];
  rpcReads?: MockRpcRead[];
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Unsupported fixture request: ${message}`);
}

// Parse operations, never substring-match names. Validate the scenario's input contract before
// returning data. Unsupported requests throw in the Playwright route handler, failing the test.
function operation(route: Route) {
  check(route.request().method() === "POST", "GraphQL method must be POST");
  const body = JSON.parse(route.request().postData() ?? "null");
  check(body && typeof body.query === "string", "GraphQL query is required");
  const definitions = parse(body.query).definitions;
  check(
    definitions.length === 1 && definitions[0].kind === Kind.OPERATION_DEFINITION,
    "one named query is required"
  );
  const definition = definitions[0];
  check(definition.operation === "query" && definition.name, "one named query is required");
  const name = definition.name.value;
  check(!body.operationName || body.operationName === name, "operationName does not match query");
  const fields = definition.selectionSet.selections.map((field) => {
    check(field.kind === Kind.FIELD, "top-level fragments are not supported by this fixture");
    return field.name.value;
  });
  return { name, fields, variables: body.variables ?? {} };
}

/** Install strict indexer/EAS/RPC scenarios before navigation and return request accounting. */
export async function mockClientBackend(page: Page, options: MockClientBackendOptions = {}) {
  const garden = options.garden ?? MOCK_CLIENT_GARDEN;
  const action = options.action ?? MOCK_CLIENT_ACTION;
  const requests = new Map<string, number>();
  const unavailable = new Set<string>();
  const failures: string[] = [];
  const allowedSchemas = [
    deployment.schemas.workSchemaUID,
    deployment.schemas.workApprovalSchemaUID,
    deployment.schemas.assessmentSchemaUID,
  ];
  const allowedAddresses = [...roles, garden.id, garden.tokenAddress].map((address) =>
    address.toLowerCase()
  );

  function matches(row: MockAttestation, where: Record<string, any>): boolean {
    return Object.entries(where)
      .map(([field, filter]) => {
        if (field === "revoked") {
          check(filter.equals === false, "revoked filter");
          return true;
        }
        if (field === "OR") {
          check(Array.isArray(filter), "OR filter");
          return filter.map((part: Record<string, any>) => matches(row, part)).some(Boolean);
        }
        check(
          ["schemaId", "recipient", "attester", "id", "decodedDataJson"].includes(field),
          `EAS filter ${field}`
        );
        check(
          filter && typeof filter === "object" && Object.keys(filter).length === 1,
          `EAS ${field} filter`
        );
        const [operator, value] = Object.entries(filter)[0];
        check(["equals", "in", "contains"].includes(operator), `EAS ${field} operator`);
        const values = operator === "in" ? value : [value];
        check(
          Array.isArray(values) && values.every((v) => typeof v === "string"),
          `EAS ${field} values`
        );
        if (field === "schemaId")
          check(
            values.every((v) => allowedSchemas.includes(v)),
            "EAS schemaId"
          );
        if (field === "recipient" || field === "attester")
          check(
            values.every((v) => allowedAddresses.includes(v.toLowerCase())),
            `EAS ${field} address`
          );
        const actual = String(row[field as keyof MockAttestation]).toLowerCase();
        return values.some((v) =>
          operator === "contains" ? actual.includes(v.toLowerCase()) : actual === v.toLowerCase()
        );
      })
      .every(Boolean);
  }

  async function handle(route: Route, boundary: "indexer" | "eas") {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: GRAPHQL_HEADERS });
    try {
      const { name, fields, variables: v } = operation(route);
      let data: Record<string, unknown>;
      if (boundary === "indexer") {
        const expectedFields: Record<string, string[]> = {
          Gardens: ["Garden", "GardenDomains"],
          Gardeners: ["Gardener"],
          Actions: ["Action"],
          GetStewardGardens: ["Garden"],
          Garden: ["Garden", "GardenDomains"],
          GardenVaultsByGarden: ["GardenVault"],
          VaultDepositsByUser: ["VaultDeposit"],
          VaultDepositsByGarden: ["VaultDeposit"],
          VaultEventsByGarden: ["VaultEvent"],
          YieldAllocations: ["YieldAllocation"],
          GardenYieldAllocations: ["YieldAllocation"],
          GardenHypercerts: ["Hypercert"],
          CommitmentMembership: ["CommitmentContributor"],
          Commitments: ["Commitment"],
        };
        check(expectedFields[name], `Unsupported indexer operation ${name}`);
        check(
          fields.length > 0 && fields.every((field) => expectedFields[name].includes(field)),
          `${name} fields`
        );
        check(
          (name === "Actions" ? v.where?.chainId?._eq : v.chainId) === 11155111,
          `${name} chainId must be 11155111`
        );
        switch (name) {
          case "Gardens":
            data = { Garden: [garden], GardenDomains: [{ garden: garden.id, domainMask: 2 }] };
            break;
          case "Garden":
            if (v.id?.toLowerCase() === deployment.rootGarden.address.toLowerCase()) {
              // The selected scenario has no indexed protocol-root garden.
              data = { Garden: [], GardenDomains: [] };
              break;
            }
            check(
              [garden.id, garden.tokenAddress].some(
                (address) => address.toLowerCase() === v.id?.toLowerCase()
              ),
              `Garden id ${v.id}`
            );
            data = { Garden: [garden], GardenDomains: [{ garden: garden.id, domainMask: 2 }] };
            break;
          case "GardenVaultsByGarden":
          case "VaultDepositsByGarden":
          case "GardenYieldAllocations":
          case "YieldAllocations":
          case "VaultEventsByGarden":
            check(
              [garden.id, garden.tokenAddress].some(
                (address) => address.toLowerCase() === v.garden?.toLowerCase()
              ),
              `${name} garden`
            );
            if (name === "YieldAllocations" || name === "VaultEventsByGarden") {
              check(Number.isInteger(v.limit) && v.limit > 0, `${name} limit`);
            }
            data = { [expectedFields[name][0]]: [] };
            break;
          case "VaultDepositsByUser":
            check(
              [garden.id, garden.tokenAddress].some(
                (address) => address.toLowerCase() === v.garden?.toLowerCase()
              ) && allowedAddresses.includes(v.depositor?.toLowerCase()),
              "VaultDepositsByUser addresses"
            );
            data = { VaultDeposit: [] };
            break;
          case "Gardeners":
            check(
              Number.isInteger(v.limit) &&
                v.limit > 0 &&
                Number.isInteger(v.offset) &&
                v.offset >= 0,
              "Gardeners pagination"
            );
            data = { Gardener: [] };
            break;
          case "GardenHypercerts":
            check(
              v.gardenId?.toLowerCase() === garden.id.toLowerCase(),
              "GardenHypercerts gardenId"
            );
            check(Number.isInteger(v.limit) && v.limit > 0, "GardenHypercerts limit");
            data = { Hypercert: [] };
            break;
          case "CommitmentMembership":
          case "Commitments":
            check(allowedAddresses.includes(v.account?.toLowerCase()), `${name} account`);
            check(
              Object.keys(v).every((key) =>
                ["chainId", "account", ...(name === "Commitments" ? ["state"] : [])].includes(key)
              ),
              `${name} variables`
            );
            check(v.state === undefined || v.state === "ACCEPTED", `${name} state`);
            data = { [expectedFields[name][0]]: [] };
            break;
          case "GetStewardGardens":
            check(
              Array.isArray(v.steward) &&
                v.steward.length === 1 &&
                allowedAddresses.includes(v.steward[0].toLowerCase()),
              "GetStewardGardens steward"
            );
            data = {
              Garden: [...garden.operators, ...garden.owners].some(
                (address) => address.toLowerCase() === v.steward[0].toLowerCase()
              )
                ? [{ id: garden.id, name: garden.name }]
                : [],
            };
            break;
          default:
            check(
              Object.keys(v.where).every((key) => ["chainId", "id"].includes(key)),
              "Actions where"
            );
            check(
              !v.where.id ||
                (Array.isArray(v.where.id._in) &&
                  v.where.id._in.every((id: unknown) => typeof id === "string")),
              "Actions ids"
            );
            data = { Action: !v.where.id || v.where.id._in.includes(action.id) ? [action] : [] };
        }
      } else {
        check(
          [
            "Attestations",
            "WorkListPage",
            "WorkApprovalsForWork",
            "WorkApprovalsForWorks",
            "Assessments",
          ].includes(name),
          `Unsupported EAS operation ${name}`
        );
        check(fields.length === 1 && fields[0] === "attestations", `${name} fields`);
        check(v.where && typeof v.where === "object" && v.where.schemaId, `${name} where/schemaId`);
        // Validate even when the selected scenario is empty.
        const control: MockAttestation = {
          id: "",
          schemaId: deployment.schemas.workSchemaUID,
          attester: roles[0],
          recipient: garden.id,
          timeCreated: 0,
          decodedDataJson: "",
        };
        matches(control, v.where);
        check(v.take === undefined || (Number.isInteger(v.take) && v.take > 0), `${name} take`);
        check(v.skip === undefined || (Number.isInteger(v.skip) && v.skip >= 0), `${name} skip`);
        const rows = (options.attestations ?? []).filter((row) => matches(row, v.where));
        data = {
          attestations: rows.slice(
            v.skip ?? 0,
            v.take === undefined ? undefined : (v.skip ?? 0) + v.take
          ),
        };
      }
      const key = `${boundary}: ${name}`;
      requests.set(key, (requests.get(key) ?? 0) + 1);
      return route.fulfill({
        status: unavailable.has(key) ? 503 : 200,
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify(
          unavailable.has(key) ? { errors: [{ message: "Injected fixture outage" }] } : { data }
        ),
      });
    } catch (error) {
      failures.push(String(error));
      throw error;
    }
  }
  await page.route("**/v1/graphql", (route) => handle(route, "indexer"));
  await page.route("**/api/graphql", (route) => handle(route, "indexer"));
  await page.route("https://sepolia.easscan.org/graphql", (route) => handle(route, "eas"));
  await mockSepoliaRpc(page, { garden, reads: options.rpcReads, requests });
  return {
    requests,
    setUnavailable(key: string, value: boolean) {
      if (value) unavailable.add(key);
      else unavailable.delete(key);
    },
    assertSatisfied() {
      check(failures.length === 0, failures.join("; "));
      const missing = (options.required ?? []).filter((key) => !requests.has(key));
      if (missing.length)
        throw new Error(`Missing required fixture requests: ${missing.join(", ")}`);
    },
  };
}
