import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetNetworkContracts, mockIndexerQuery, mockReadContract } = vi.hoisted(() => ({
  mockGetNetworkContracts: vi.fn(),
  mockIndexerQuery: vi.fn(),
  mockReadContract: vi.fn(),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getNetworkConfig: () => ({ rpcUrl: "http://localhost:8545" }),
}));

vi.mock("../../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: {
    query: (...args: unknown[]) => mockIndexerQuery(...args),
  },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getChain: () => ({ id: 11155111 }),
  getNetworkContracts: (...args: unknown[]) => mockGetNetworkContracts(...args),
}));

vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createPublicClient: () => ({
      readContract: (...args: unknown[]) => mockReadContract(...args),
    }),
    http: () => ({}),
  };
});

import {
  getCampaignCookieJarCampaigns,
  getCampaignCookieJarTrustedCreators,
  getIndexedCampaignCookieJars,
} from "../../../modules/data/campaign-cookie-jars";

const REGISTRY = "0x1111111111111111111111111111111111111111" as Address;
const CREATOR = "0x2222222222222222222222222222222222222222" as Address;
const TRUSTED = "0x3333333333333333333333333333333333333333" as Address;
const FACTORY = "0x4444444444444444444444444444444444444444" as Address;
const TRUSTED_JAR = "0x5555555555555555555555555555555555555555" as Address;
const UNTRUSTED = "0x6666666666666666666666666666666666666666" as Address;
const UNTRUSTED_JAR = "0x7777777777777777777777777777777777777777" as Address;

function campaignMetadata(slug: string, title: string) {
  return JSON.stringify({
    kind: "green-goods.campaign-cookie-jar",
    version: 1,
    slug,
    title,
    sourceGardens: [],
    operatorPolicy: "one-operator-per-garden",
    extraAllowlist: [],
    chainId: 11155111,
    createdAt: 1770000000,
  });
}

function indexedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: `11155111-${TRUSTED_JAR.toLowerCase()}`,
    chainId: 11155111,
    factoryAddress: FACTORY,
    jarAddress: TRUSTED_JAR,
    creator: CREATOR,
    rawMetadata: campaignMetadata("earth-week", "Earth Week Cookie Jar"),
    metadataKind: "green-goods.campaign-cookie-jar",
    metadataVersion: 1,
    slug: "earth-week",
    title: "Earth Week Cookie Jar",
    sourceGardens: [],
    operatorPolicy: "one-operator-per-garden",
    extraAllowlist: [],
    isValidCampaign: true,
    createdAt: 1770000000,
    metadataUpdatedAt: 1770000000,
    txHash: "0xhash",
    ...overrides,
  };
}

describe("modules/data/campaign-cookie-jars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNetworkContracts.mockReturnValue({
      deploymentRegistry: REGISTRY,
      cookieJarFactory: FACTORY,
    });
  });

  it("throws when indexed campaign discovery fails", async () => {
    mockIndexerQuery.mockResolvedValueOnce({ error: new Error("indexer offline") });

    await expect(getIndexedCampaignCookieJars(11155111)).rejects.toThrow(
      "Campaign cookie jar indexer query failed: indexer offline"
    );
  });

  it("throws when DeploymentRegistry trust reads are unavailable", async () => {
    mockReadContract.mockRejectedValue(new Error("rpc offline"));

    await expect(getCampaignCookieJarTrustedCreators(11155111)).rejects.toThrow(
      "Campaign cookie jar trust registry reads failed: rpc offline; rpc offline"
    );
  });

  it("dedupes trusted creators from the registry owner and allowlist", async () => {
    mockReadContract.mockResolvedValueOnce(CREATOR).mockResolvedValueOnce([CREATOR, TRUSTED]);

    await expect(getCampaignCookieJarTrustedCreators(11155111)).resolves.toEqual([
      CREATOR,
      TRUSTED,
    ]);
  });

  it("queries indexed campaigns by trusted creator before applying the public list limit", async () => {
    mockReadContract.mockImplementation(
      ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        if (functionName === "owner") return Promise.resolve(CREATOR);
        if (functionName === "getAllowlist") return Promise.resolve([TRUSTED]);
        if (functionName === "getMetadata" && args?.[0] === TRUSTED_JAR) {
          return Promise.resolve(campaignMetadata("earth-week", "Earth Week Cookie Jar"));
        }
        throw new Error(`unexpected read ${functionName}`);
      }
    );
    mockIndexerQuery.mockResolvedValueOnce({
      data: {
        CampaignCookieJar: [
          indexedRow(),
          indexedRow({
            id: `11155111-${UNTRUSTED_JAR.toLowerCase()}`,
            jarAddress: UNTRUSTED_JAR,
            creator: UNTRUSTED,
            rawMetadata: campaignMetadata("spam", "Spam Jar"),
            slug: "spam",
            title: "Spam Jar",
          }),
        ],
      },
    });

    const campaigns = await getCampaignCookieJarCampaigns(11155111);

    expect(campaigns.map((campaign) => campaign.jarAddress)).toEqual([TRUSTED_JAR]);
    expect(mockIndexerQuery).toHaveBeenCalledWith(
      expect.stringContaining("creator: { _in: $creators }"),
      {
        chainId: 11155111,
        creators: [CREATOR.toLowerCase(), TRUSTED.toLowerCase()],
        limit: 100,
      },
      "getIndexedCampaignCookieJars"
    );
    expect(
      mockReadContract.mock.calls.filter(
        ([call]) => (call as { functionName?: string }).functionName === "getMetadata"
      )
    ).toHaveLength(1);
  });
});
