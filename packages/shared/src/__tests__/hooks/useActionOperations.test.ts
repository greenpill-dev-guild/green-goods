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
import { useActionRegistrationStore } from "../../stores/useActionRegistrationStore";
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

    useActionRegistrationStore.setState({ pending: {}, edits: {} });
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

    it.each([
      "unresolved",
      "confirmed",
      "reverted",
    ] as const)("retains and reconciles a pending edit across remount: %s", async (status) => {
      vi.mocked(simulateTransaction).mockResolvedValue({ success: true });
      send.mockResolvedValueOnce({
        hash: "0xEditProposal",
        sponsored: false,
        confirmation: "pending",
      });
      const first = renderHook(() => useActionOperations(11155111, "42"));
      const response = await runInAct(() =>
        first.result.current.updateActionTitle("42", "New title")
      );
      expect(response.confirmation).toBe("pending");
      const saved = sessionStorage.getItem("green-goods:action-registrations")!;
      first.unmount();
      useActionRegistrationStore.setState({ pending: {}, edits: {} });
      sessionStorage.setItem("green-goods:action-registrations", saved);
      await useActionRegistrationStore.persist.rehydrate();
      sender!.reconcileBroadcast = vi
        .fn()
        .mockResolvedValue({ status, transactionHash: "0xExecution" });
      const restored = renderHook(() => useActionOperations(11155111, "42"));
      expect(restored.result.current.pendingEdits).toHaveLength(1);
      await runInAct(() => restored.result.current.updateActionTitle("42", "Another title"));
      expect(send).toHaveBeenCalledOnce();
      await runInAct(() => restored.result.current.reconcileEdits());
      if (status === "unresolved") expect(restored.result.current.pendingEdits).toHaveLength(1);
      else {
        expect(restored.result.current.pendingEdits).toHaveLength(0);
        const resumed = await runInAct(() =>
          restored.result.current.updateActionTitle("42", "New title")
        );
        expect(resumed.success).toBe(true);
        expect(send).toHaveBeenCalledTimes(status === "confirmed" ? 1 : 2);
      }
    });

    it("preserves a pending registration across hook remount without another send", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({ success: true });
      const operation = `0x${"cd".repeat(32)}` as const;
      send.mockImplementationOnce(async (_call, options) => {
        await options.onBroadcastReference({
          kind: "user-operation",
          hash: operation,
          chainId: 11155111,
        });
        expect(sessionStorage.getItem("green-goods:action-registrations")).toContain(operation);
        throw new Error("Receipt RPC timeout");
      });
      const params = {
        startTime: 1234567890,
        endTime: 1234567899,
        title: "First",
        slug: "first",
        domain: 0,
        instructions: "ipfs://instructions",
        capitals: [],
        media: [],
      };
      const first = renderHook(() => useActionOperations(11155111));
      const accepted = await runInAct(() => first.result.current.registerAction(params));
      expect(accepted.confirmation).toBe("pending");
      expect(first.result.current.pendingRegistration?.hash).toBe(operation);
      first.unmount();
      const restored = renderHook(() => useActionOperations(11155111));
      await runInAct(() => restored.result.current.registerAction(params));
      const checked = await runInAct(() => restored.result.current.reconcileRegistration());
      expect(checked.confirmation).toBe("pending");
      expect(send).toHaveBeenCalledTimes(1);
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    it("isolates pending registrations by account and chain across storage restoration", async () => {
      const firstAccount = primaryAddress!;
      const pending = { hash: "0xProposal", sponsored: false, confirmation: "pending" } as const;
      useActionRegistrationStore.getState().record(firstAccount, 11155111, pending);
      // Rehydrate the actual persisted ledger rather than relying on an in-memory remount.
      const saved = sessionStorage.getItem("green-goods:action-registrations")!;
      useActionRegistrationStore.setState({ pending: {} });
      // setState persists too; restore the saved entry as a browser reload would.
      sessionStorage.setItem("green-goods:action-registrations", saved);
      await useActionRegistrationStore.persist.rehydrate();
      const first = renderHook(() => useActionOperations(11155111));
      expect(first.result.current.pendingRegistration).toEqual(pending);
      first.unmount();
      primaryAddress = "0x2222222222222222222222222222222222222222";
      const otherAccount = renderHook(() => useActionOperations(11155111));
      expect(otherAccount.result.current.pendingRegistration).toBeUndefined();
      otherAccount.unmount();
      primaryAddress = firstAccount;
      const otherChain = renderHook(() => useActionOperations(42161));
      expect(otherChain.result.current.pendingRegistration).toBeUndefined();
      otherChain.unmount();
      const returned = renderHook(() => useActionOperations(11155111));
      expect(returned.result.current.pendingRegistration).toEqual(pending);
      expect(send).not.toHaveBeenCalled();
    });

    it.each([
      "confirmed",
      "reverted",
    ] as const)("clears only the reconciled registration on %s", async (status) => {
      const pending = { hash: "0xProposal", sponsored: false, confirmation: "pending" } as const;
      useActionRegistrationStore.getState().record(primaryAddress!, 11155111, pending);
      useActionRegistrationStore.getState().record(primaryAddress!, 42161, pending);
      sender!.reconcileBroadcast = vi
        .fn()
        .mockResolvedValue({ status, transactionHash: "0xExecution" });
      const { result } = renderHook(() => useActionOperations(11155111));
      const outcome = await runInAct(() => result.current.reconcileRegistration());
      expect(outcome.success).toBe(status === "confirmed");
      expect(result.current.pendingRegistration).toBeUndefined();
      expect(Object.values(useActionRegistrationStore.getState().pending)).toEqual([pending]);
      expect(send).not.toHaveBeenCalled();
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
