/**
 * useSetGardenDomains Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Address, Domain } from "../../../types/domain";

const TEST_CHAIN_ID = 11155111;
const TEST_ACTION_REGISTRY = "0x1111111111111111111111111111111111111111";
const TEST_GARDEN = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const;

const mockSendContractTx = vi.fn();
const mockCreateMutationErrorHandler = vi.fn();
const mockErrorHandler = vi.fn();

const toastService = {
  loading: vi.fn(() => "toast-id"),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../hooks/blockchain/useContractTxSender", () => ({
  useContractTxSender: () => mockSendContractTx,
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  ActionRegistryABI: [],
  getNetworkContracts: () => ({
    actionRegistry: TEST_ACTION_REGISTRY,
  }),
}));

vi.mock("../../../components/toast", () => ({
  toastService,
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: (...args: unknown[]) => {
    mockCreateMutationErrorHandler(...args);
    return mockErrorHandler;
  },
}));

const messages = {
  "app.garden.domains.updating": "Updating domains...",
  "app.garden.domains.updateSuccess": "Domains updated",
} as const;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages }, children)
    );
  };
}

const { useSetGardenDomains } = await import("../../../hooks/garden/useSetGardenDomains");

describe("useSetGardenDomains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutationErrorHandler.mockReturnValue(mockErrorHandler);
  });

  it("sends setGardenDomains transaction with computed domain mask", async () => {
    mockSendContractTx.mockResolvedValueOnce(MOCK_TX_HASH);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetGardenDomains(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as Address,
        domains: [Domain.SOLAR, Domain.WASTE],
      });
    });

    expect(mockSendContractTx).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_ACTION_REGISTRY,
        functionName: "setGardenDomains",
        args: [TEST_GARDEN, (1 << Domain.SOLAR) | (1 << Domain.WASTE)],
      })
    );
    expect(toastService.loading).toHaveBeenCalled();
    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(toastService.success).toHaveBeenCalled();

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["readContract", { functionName: "gardenDomains", args: [TEST_GARDEN] }],
      })
    );
  });

  it("rejects empty domain updates", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useSetGardenDomains(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as Address,
        domains: [],
      })
    ).rejects.toThrow("At least one domain is required");

    expect(mockSendContractTx).not.toHaveBeenCalled();
    expect(mockErrorHandler).toHaveBeenCalled();
  });
});
