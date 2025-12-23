/**
 * useWorkMutation Hook Tests
 *
 * Tests for work submission mutation with auth mode branching,
 * online/offline detection, and job queue integration.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("../../modules/work/wallet-submission", () => ({
  submitWorkDirectly: vi.fn(),
}));

vi.mock("../../modules/work/work-submission", () => ({
  submitWorkToQueue: vi.fn(),
}));

vi.mock("../../modules/job-queue", () => ({
  jobQueue: {
    processJob: vi.fn(),
  },
}));

vi.mock("../../components/toast", () => ({
  toastService: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
  workToasts: {
    submitting: vi.fn(),
    savedOffline: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("../../stores/useUIStore", () => ({
  useUIStore: vi.fn(() => vi.fn()),
}));

vi.mock("../../stores/useWorkFlowStore", () => ({
  useWorkFlowStore: {
    getState: vi.fn(() => ({
      setSubmissionCompleted: vi.fn(),
    })),
  },
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

vi.mock("../../utils/action/parsers", () => ({
  getActionTitle: vi.fn(() => "Test Action"),
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock("../../utils/errors/contract-errors", () => ({
  parseAndFormatError: vi.fn(() => ({
    title: "Error",
    message: "Something went wrong",
    parsed: { isKnown: false, name: "unknown" },
  })),
}));

import { workToasts } from "../../components/toast";
import { useWorkMutation } from "../../hooks/work/useWorkMutation";
import { jobQueue } from "../../modules/job-queue";
import { submitWorkDirectly } from "../../modules/work/wallet-submission";
import { submitWorkToQueue } from "../../modules/work/work-submission";
import {
  createMockAction,
  createMockFiles,
  createMockSmartAccountClient,
  createMockWorkDraft,
  MOCK_ADDRESSES,
  MOCK_TX_HASH,
} from "../test-utils";

describe("hooks/work/useWorkMutation", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Default: online
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const defaultOptions = {
    authMode: "wallet" as const,
    smartAccountClient: null,
    gardenAddress: MOCK_ADDRESSES.garden,
    actionUID: 1,
    actions: [createMockAction({ id: "1" })],
    userAddress: MOCK_ADDRESSES.user,
  };

  describe("Wallet mode - online", () => {
    it("calls submitWorkDirectly when online", async () => {
      vi.mocked(submitWorkDirectly).mockResolvedValue(MOCK_TX_HASH);

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      const draft = createMockWorkDraft();
      const images = createMockFiles(2);

      await act(async () => {
        await result.current.mutateAsync({ draft, images });
      });

      expect(submitWorkDirectly).toHaveBeenCalledWith(
        draft,
        MOCK_ADDRESSES.garden,
        1,
        "Test Action",
        84532,
        images
      );
      expect(submitWorkToQueue).not.toHaveBeenCalled();
    });
  });

  describe("Wallet mode - offline", () => {
    it("queues via submitWorkToQueue when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      vi.mocked(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_123",
        jobId: "job-123",
        clientWorkId: "work-123",
      });

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      const draft = createMockWorkDraft();
      const images = createMockFiles(1);

      await act(async () => {
        await result.current.mutateAsync({ draft, images });
      });

      expect(submitWorkToQueue).toHaveBeenCalled();
      expect(submitWorkDirectly).not.toHaveBeenCalled();
      expect(workToasts.savedOffline).toHaveBeenCalled();
    });
  });

  describe("Passkey mode - online", () => {
    it("queues and processes inline when online with smart account", async () => {
      const smartAccountClient = createMockSmartAccountClient();

      vi.mocked(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_abc",
        jobId: "job-abc",
        clientWorkId: "work-abc",
      });

      vi.mocked(jobQueue.processJob).mockResolvedValue({
        success: true,
        txHash: MOCK_TX_HASH,
        skipped: false,
      });

      const { result } = renderHook(
        () =>
          useWorkMutation({
            ...defaultOptions,
            authMode: "passkey",
            smartAccountClient: smartAccountClient as any,
            userAddress: MOCK_ADDRESSES.smartAccount, // Use smart account address for passkey mode
          }),
        { wrapper: createWrapper() }
      );

      const draft = createMockWorkDraft();
      const images = createMockFiles(1);

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.mutateAsync({ draft, images });
      });

      expect(submitWorkToQueue).toHaveBeenCalled();
      expect(jobQueue.processJob).toHaveBeenCalledWith("job-abc", {
        smartAccountClient,
      });
      expect(txHash).toBe(MOCK_TX_HASH);
    });
  });

  describe("Passkey mode - offline", () => {
    it("queues without processing when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      vi.mocked(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_xyz",
        jobId: "job-xyz",
        clientWorkId: "work-xyz",
      });

      const { result } = renderHook(
        () =>
          useWorkMutation({
            ...defaultOptions,
            authMode: "passkey",
            smartAccountClient: createMockSmartAccountClient() as any,
            userAddress: MOCK_ADDRESSES.smartAccount, // Use smart account address for passkey mode
          }),
        { wrapper: createWrapper() }
      );

      const draft = createMockWorkDraft();
      const images = createMockFiles(1);

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.mutateAsync({ draft, images });
      });

      expect(submitWorkToQueue).toHaveBeenCalled();
      expect(jobQueue.processJob).not.toHaveBeenCalled();
      expect(txHash).toBe("0xoffline_xyz");
    });
  });

  describe("Success handling", () => {
    it("shows success toast for wallet mode", async () => {
      vi.mocked(submitWorkDirectly).mockResolvedValue(MOCK_TX_HASH);

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: [],
        });
      });

      await waitFor(() => {
        expect(workToasts.success).toHaveBeenCalled();
      });
    });

    it("returns offline hash for queued work", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      vi.mocked(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_queued",
        jobId: "job-q",
        clientWorkId: "work-q",
      });

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: [],
        });
      });

      expect(txHash).toBe("0xoffline_queued");
      expect(txHash?.startsWith("0xoffline_")).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("shows error toast on submission failure", async () => {
      const error = new Error("Submission failed");
      vi.mocked(submitWorkDirectly).mockRejectedValue(error);

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            draft: createMockWorkDraft(),
            images: [],
          });
        } catch {
          // Expected to throw
        }
      });

      // Wait for error state to be set
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});
