/**
 * useGardenRoles Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
const mockReadContract = vi.fn();

vi.mock("@wagmi/core", () => ({
  readContract: (config: unknown, args: unknown) => mockReadContract(config, args),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

// Dynamically import after mocks
let useGardenRoles: typeof import("../../../hooks/roles/useGardenRoles").useGardenRoles;

beforeAll(async () => {
  const module = await import("../../../hooks/roles/useGardenRoles");
  useGardenRoles = module.useGardenRoles;
});

const MOCK_GARDEN = "0x1111111111111111111111111111111111111111";
const MOCK_USER = "0x2222222222222222222222222222222222222222";

describe("useGardenRoles", () => {
  let queryClient: QueryClient;

  const createWrapper =
    () =>
    ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("returns roles for a user", async () => {
    mockReadContract.mockImplementation(async (_config: unknown, args: unknown) => {
      const functionName = (args as { functionName?: string })?.functionName;
      if (functionName === "isOperator") return true;
      if (functionName === "isGardener") return false;
      if (functionName === "isEvaluator") return false;
      if (functionName === "isOwner") return false;
      if (functionName === "isFunder") return true;
      if (functionName === "isCommunity") return false;
      return false;
    });

    const { result } = renderHook(() => useGardenRoles(MOCK_GARDEN, MOCK_USER), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roles).toContain("operator");
    expect(result.current.roles).toContain("funder");
  });

  it("returns all roles when all checks succeed", async () => {
    mockReadContract.mockResolvedValue(true);

    const { result } = renderHook(() => useGardenRoles(MOCK_GARDEN, MOCK_USER), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roles.sort()).toEqual([
      "community",
      "evaluator",
      "funder",
      "gardener",
      "operator",
      "owner",
    ]);
  });

  it("returns empty roles when contract calls fail", async () => {
    mockReadContract.mockRejectedValue(new Error("Contract error"));

    const { result } = renderHook(() => useGardenRoles(MOCK_GARDEN, MOCK_USER), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roles).toEqual([]);
  });

  it("returns empty roles when disabled", () => {
    const { result } = renderHook(() => useGardenRoles(undefined, undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.roles).toEqual([]);
  });
});
