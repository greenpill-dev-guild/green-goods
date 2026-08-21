/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), warn: vi.fn() }));

vi.mock("../../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));
vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: (...args: unknown[]) => mocks.warn(...args) },
}));
vi.mock("../../../config/blockchain", () => ({ DEFAULT_CHAIN_ID: 42161 }));

import { usePublicCommitmentImpact } from "../../../hooks/public/usePublicCommitmentImpact";
import { getPublicCommitmentImpact } from "../../../modules/commitment-pooling/data-public-impact";

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function containsAddressValue(value: unknown): boolean {
  if (typeof value === "string") return /^0x[0-9a-f]{40}$/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsAddressValue);
}

describe("public commitment impact reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(async (_query, variables, operation) => {
      if (operation === "getPublicCommitmentImpactPools") {
        return {
          data: {
            CommitmentPool: [{ poolId: "7" }, { poolId: "9" }],
            CommitmentPool_aggregate: {
              aggregate: {
                count: 2,
                sum: { commitmentsFulfilled: "12", commitmentsDue: "15" },
              },
            },
          },
        };
      }
      if (operation === "getPublicCommitmentImpactProviders") {
        expect(variables).toEqual({ chainId: 42161, poolIds: ["7", "9"] });
        return {
          data: { CommitmentProviderExposure_aggregate: { aggregate: { count: 4 } } },
        };
      }
      return {
        data: {
          Disbursement_aggregate: { aggregate: { sum: { amount: "8000000000000000000" } } },
        },
      };
    });
  });

  it("returns protocol aggregates without returning provider or settlement rows", async () => {
    const result = await getPublicCommitmentImpact(42161);
    const documents = mocks.query.mock.calls.map(([document]) => document).join("\n");

    expect(documents).toContain("CommitmentProviderExposure_aggregate");
    expect(documents).not.toContain("CommitmentProviderExposure(");
    expect(documents).not.toContain("Disbursement(");
    expect(documents).toContain("state: { _eq: CONFIRMED }");
    expect(documents).not.toContain("distinctProviderCount");
    expect(containsAddressValue(result)).toBe(false);
    expect(result).toEqual({
      openPoolCount: 2n,
      commitmentsFulfilled: 12n,
      commitmentsDue: 15n,
      distinctProviderCount: 4n,
      confirmedDisbursementTotal: 8000000000000000000n,
      partialData: false,
      unavailableSources: {
        commitmentPools: false,
        distinctProviders: false,
        confirmedSettlement: false,
      },
    });
  });

  it("keeps other aggregates publishable when the distinct-provider read fails", async () => {
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicCommitmentImpactPools") {
        return {
          data: {
            CommitmentPool: [{ poolId: "7" }],
            CommitmentPool_aggregate: {
              aggregate: {
                count: 1,
                sum: { commitmentsFulfilled: "5", commitmentsDue: "6" },
              },
            },
          },
        };
      }
      if (operation === "getPublicCommitmentImpactProviders") {
        return { error: new Error("provider aggregate unavailable") };
      }
      return {
        data: { Disbursement_aggregate: { aggregate: { sum: { amount: "20" } } } },
      };
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(() => usePublicCommitmentImpact(), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      openPoolCount: 1n,
      commitmentsFulfilled: 5n,
      commitmentsDue: 6n,
      distinctProviderCount: null,
      confirmedDisbursementTotal: 20n,
      partialData: true,
      unavailableSources: { distinctProviders: true },
    });
    expect(mocks.warn).toHaveBeenCalledOnce();
  });
});
