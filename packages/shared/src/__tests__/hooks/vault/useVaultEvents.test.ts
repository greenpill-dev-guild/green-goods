/**
 * useVaultEvents Hook Tests
 * @vitest-environment jsdom
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x2222222222222222222222222222222222222222";

const mockGetVaultEvents = vi.fn();

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../modules/data/vaults", () => ({
  getVaultEvents: (...args: unknown[]) => mockGetVaultEvents(...args),
}));

import { useVaultEvents } from "../../../hooks/vault/useVaultEvents";

describe("useVaultEvents", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it("fetches events for a garden address", async () => {
    const mockEvents = [
      {
        id: "event-1",
        chainId: TEST_CHAIN_ID,
        garden: TEST_GARDEN.toLowerCase(),
        asset: "0x1111111111111111111111111111111111111111",
        vaultAddress: "0x3333333333333333333333333333333333333333",
        eventType: "DEPOSIT",
        actor: "0x4444444444444444444444444444444444444444",
        amount: 1000n,
        shares: 950n,
        txHash: "0xabcd",
        timestamp: 1700000000,
      },
    ];
    mockGetVaultEvents.mockResolvedValue(mockEvents);

    const { result } = renderHookWithQueryClient(
      () => useVaultEvents(TEST_GARDEN, { enabled: true }),
      {
        queryClient,
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetVaultEvents).toHaveBeenCalledWith(TEST_GARDEN.toLowerCase(), TEST_CHAIN_ID, 100);
    expect(result.current.events).toEqual(mockEvents);
  });

  it("returns empty array when no data yet", () => {
    mockGetVaultEvents.mockReturnValue(new Promise(() => {}));

    const { result } = renderHookWithQueryClient(
      () => useVaultEvents(TEST_GARDEN, { enabled: true }),
      {
        queryClient,
      }
    );

    expect(result.current.events).toEqual([]);
  });

  it("disables query when no garden address is provided", () => {
    const { result } = renderHookWithQueryClient(
      () => useVaultEvents(undefined, { enabled: true }),
      {
        queryClient,
      }
    );

    expect(mockGetVaultEvents).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("disables query when enabled is false", () => {
    const { result } = renderHookWithQueryClient(
      () => useVaultEvents(TEST_GARDEN, { enabled: false }),
      {
        queryClient,
      }
    );

    expect(mockGetVaultEvents).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("uses default limit of 100", async () => {
    mockGetVaultEvents.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() => useVaultEvents(TEST_GARDEN), {
      queryClient,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetVaultEvents).toHaveBeenCalledWith(TEST_GARDEN.toLowerCase(), TEST_CHAIN_ID, 100);
  });

  it("respects custom limit option", async () => {
    mockGetVaultEvents.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() => useVaultEvents(TEST_GARDEN, { limit: 50 }), {
      queryClient,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetVaultEvents).toHaveBeenCalledWith(TEST_GARDEN.toLowerCase(), TEST_CHAIN_ID, 50);
  });

  it("normalizes garden address to lowercase", async () => {
    mockGetVaultEvents.mockResolvedValue([]);
    const mixedCase = "0xABCDef1234567890ABCDef1234567890ABCDef12";

    const { result } = renderHookWithQueryClient(() => useVaultEvents(mixedCase), {
      queryClient,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetVaultEvents).toHaveBeenCalledWith(mixedCase.toLowerCase(), TEST_CHAIN_ID, 100);
  });
});
