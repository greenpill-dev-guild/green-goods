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
  getCampaignCookieJarTrustedCreators,
  getIndexedCampaignCookieJars,
} from "../../../modules/data/campaign-cookie-jars";

const REGISTRY = "0x1111111111111111111111111111111111111111" as Address;
const CREATOR = "0x2222222222222222222222222222222222222222" as Address;
const TRUSTED = "0x3333333333333333333333333333333333333333" as Address;

describe("modules/data/campaign-cookie-jars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNetworkContracts.mockReturnValue({
      deploymentRegistry: REGISTRY,
      cookieJarFactory: "0x4444444444444444444444444444444444444444",
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
});
