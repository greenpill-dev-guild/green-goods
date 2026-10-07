/**
 * @vitest-environment happy-dom
 */

/**
 * useActionOperations Hook Test Suite
 *
 * Tests the action operations hook that manages ActionRegistry contract calls
 */

import { QueryClient } from "@tanstack/react-query";
import { act, renderHook as renderBareHook } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { createElement } from "react";
import en from "../../i18n/en.json";
import type { TransactionSender } from "../../modules/transactions/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActionOperations } from "../../hooks/action/useActionOperations";

let primaryAddress: `0x${string}` | null = null;
let sender: TransactionSender | null = null;
vi.mock("../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => primaryAddress }));
vi.mock("../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sender,
}));
const renderHook = <T>(hook: () => T) =>
  renderBareHook(hook, {
    wrapper: ({ children }) =>
      createElement(IntlProvider, { locale: "en", messages: en }, children),
  });

// Mock contract utils
vi.mock("../../utils/blockchain/contracts", () => ({
  ActionRegistryABI: [],
  getNetworkContracts: vi.fn(() => ({
    actionRegistry: "0xActionRegistry123",
  })),
}));

// Mock simulation
vi.mock("../../utils/blockchain/simulation", () => ({
  simulateTransaction: vi.fn(),
}));

// Mock error parsing
vi.mock("../../utils/errors/contract-errors", () => ({
  parseContractError: vi.fn((error) => ({
    name: "ContractError",
    message: error?.message || "Unknown error",
    action: undefined,
  })),
}));

// Mock toast action
vi.mock("../../hooks/app/useToastAction", () => ({
  useToastAction: vi.fn(() => ({
    executeWithToast: vi.fn(async (fn) => fn()),
  })),
}));

// Mock toast service
vi.mock("../../components/toast", () => ({
  toastService: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock react-query
const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
  QueryClient: vi.fn(() => ({})),
}));

import { useToastAction } from "../../hooks/app/useToastAction";
import { simulateTransaction } from "../../utils/blockchain/simulation";

async function runInAct<T>(callback: () => Promise<T>): Promise<T> {
  let response!: T;
  await act(async () => {
    response = await callback();
  });
  return response;
}

describe("useActionOperations", () => {
  const send = vi.fn();
  const assertOwnership = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps a test's mockReturnValue, so put back the toast default that runs the
    // write; otherwise a test that made it throw decides what the next test sees.
    vi.mocked(useToastAction).mockReturnValue({
      executeWithToast: vi.fn(async (fn) => fn()),
    } as any);

    // Default: wallet not connected
    primaryAddress = null;
    sender = null;
    send.mockReset().mockResolvedValue({ hash: "0xhash123", sponsored: false });
    assertOwnership.mockReset();
  });

  describe("when wallet is not connected", () => {
    it("returns error for registerAction when wallet not connected", async () => {
      const { result } = renderHook(() => useActionOperations(11155111));

      const response = await result.current.registerAction({
        startTime: 1234567890,
        endTime: 1234567899,
        title: "Test Action",
        slug: "waste.repair_event",
        domain: 3,
        instructions: "Test instructions",
        capitals: [],
        media: [],
      });

      expect(response.success).toBe(false);
      expect(response.error?.name).toBe("AccountNotReady");
    });

    it("returns error for updateActionTitle when wallet not connected", async () => {
      const { result } = renderHook(() => useActionOperations(11155111));

      const response = await result.current.updateActionTitle("1", "New Title");

      expect(response.success).toBe(false);
      expect(response.error?.name).toBe("AccountNotReady");
    });
  });

  describe.each(["wallet", "passkey"] as const)("when a %s account is connected", (authMode) => {
    beforeEach(() => {
      primaryAddress = "0xUserAddress123";
      sender = {
        authMode,
        supportsBatching: false,
        supportsSponsorship: authMode === "passkey",
        sendContractCall: send,
        assertOwnership,
      };
    });

    it("simulates transaction before execution", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      const mockExecuteWithToast = vi.fn(async (fn) => fn());
      vi.mocked(useToastAction).mockReturnValue({
        executeWithToast: mockExecuteWithToast,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      await runInAct(() => result.current.updateActionTitle("1", "New Title"));

      expect(simulateTransaction).toHaveBeenCalledWith(
        "0xActionRegistry123",
        expect.any(Array),
        "updateActionTitle",
        [BigInt(1), "New Title"],
        "0xUserAddress123",
        11155111
      );
    });

    it("returns error when simulation fails", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: false,
        error: {
          name: "SimulationError",
          message: "Transaction would revert",
          raw: "simulation-error",
        },
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      const response = await runInAct(() => result.current.updateActionTitle("1", "New Title"));

      expect(response.success).toBe(false);
      expect(response.error?.name).toBe("SimulationError");
    });

    it("executes transaction when simulation succeeds", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      send.mockResolvedValue({ hash: "0xtxhash456", sponsored: false });

      const mockExecuteWithToast = vi.fn(async (fn) => fn());
      vi.mocked(useToastAction).mockReturnValue({
        executeWithToast: mockExecuteWithToast,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      await runInAct(() => result.current.updateActionTitle("1", "Updated Title"));

      expect(mockExecuteWithToast).toHaveBeenCalled();
    });

    it("calls registerAction with slug and domain in the expected argument order", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      await runInAct(() =>
        result.current.registerAction({
          startTime: 1234567890,
          endTime: 1234567900,
          title: "Waste Repair Event",
          slug: "waste.repair_event",
          domain: 3,
          instructions: "bafy-test-cid",
          capitals: [1, 5],
          media: ["bafy-media-cid"],
        })
      );

      expect(simulateTransaction).toHaveBeenCalledWith(
        "0xActionRegistry123",
        expect.any(Array),
        "registerAction",
        [
          BigInt(1234567890),
          BigInt(1234567900),
          "Waste Repair Event",
          "waste.repair_event",
          "bafy-test-cid",
          [1, 5],
          ["bafy-media-cid"],
          3,
        ],
        "0xUserAddress123",
        11155111
      );
    });

    it("sends on the selected chain for the primary account", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      await runInAct(() => result.current.updateActionTitle("1", "Updated Title"));

      expect(assertOwnership).toHaveBeenCalledWith("0xUserAddress123", 11155111);
      expect(send).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          functionName: "updateActionTitle",
          account: "0xUserAddress123",
          chainId: 11155111,
        }),
        expect.objectContaining({ assertOwnership: expect.any(Function) })
      );
    });

    it("refuses a session that changed before sending", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({ success: true });
      assertOwnership.mockRejectedValueOnce(new Error("submission-ownership-changed"));
      const { result } = renderHook(() => useActionOperations(11155111));
      const response = await runInAct(() => result.current.updateActionTitle("1", "New title"));
      expect(response.success).toBe(false);
      expect(send).not.toHaveBeenCalled();
    });

    it("does not report an opaque pending submission as confirmed", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({ success: true });
      send.mockResolvedValueOnce({ hash: "0xopaque", sponsored: false, confirmation: "pending" });
      const { result } = renderHook(() => useActionOperations(11155111));
      const response = await runInAct(() => result.current.updateActionTitle("1", "New title"));
      expect(response.success).toBe(false);
      expect(response.error?.message).toContain("Check its confirmation");
    });

    it("handles contract errors during execution", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      const mockExecuteWithToast = vi.fn(async () => {
        throw new Error("Contract execution failed");
      });
      vi.mocked(useToastAction).mockReturnValue({
        executeWithToast: mockExecuteWithToast,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      const response = await runInAct(() => result.current.updateActionTitle("1", "New Title"));

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain("execution failed");
    });

    it("exposes isLoading state", () => {
      const { result } = renderHook(() => useActionOperations(11155111));

      expect(result.current.isLoading).toBe(false);
    });

    it("exposes all action operations", () => {
      const { result } = renderHook(() => useActionOperations(11155111));

      expect(result.current).toHaveProperty("registerAction");
      expect(result.current).toHaveProperty("updateActionStartTime");
      expect(result.current).toHaveProperty("updateActionEndTime");
      expect(result.current).toHaveProperty("updateActionTitle");
      expect(result.current).toHaveProperty("updateActionInstructions");
      expect(result.current).toHaveProperty("updateActionMedia");
      expect(result.current).toHaveProperty("isLoading");
    });
  });
});
