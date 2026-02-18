/**
 * Mutation Error Handler Tests
 *
 * Tests createMutationErrorHandler and createDraftErrorHandler factories
 * including toast display, analytics tracking, debug logging, and
 * known vs unknown error branching.
 *
 * NOTE: Uses vi.hoisted() + vi.mock() to ensure mocks bind correctly
 * under vitest isolate:false (shared module graph across test files).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks — vi.hoisted ensures these are available before vi.mock hoisting
// ============================================

const {
  mockToastError,
  mockWalletProgressError,
  mockTrackContractError,
  mockDebugError,
  mockParseAndFormatError,
} = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockWalletProgressError: vi.fn(),
  mockTrackContractError: vi.fn(),
  mockDebugError: vi.fn(),
  mockParseAndFormatError: vi.fn(),
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
  walletProgressToasts: {
    error: (...args: unknown[]) => mockWalletProgressError(...args),
  },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackContractError: (...args: unknown[]) => mockTrackContractError(...args),
}));

vi.mock("../../../utils/debug", () => ({
  DEBUG_ENABLED: true,
  debugError: (...args: unknown[]) => mockDebugError(...args),
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseAndFormatError: (...args: unknown[]) => mockParseAndFormatError(...args),
}));

// Dynamic import after vi.mock to ensure mocks are applied
// even when module graph is shared (isolate: false)
let createMutationErrorHandler: typeof import("../../../utils/errors/mutation-error-handler").createMutationErrorHandler;
let createDraftErrorHandler: typeof import("../../../utils/errors/mutation-error-handler").createDraftErrorHandler;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  const mod = await import("../../../utils/errors/mutation-error-handler");
  createMutationErrorHandler = mod.createMutationErrorHandler;
  createDraftErrorHandler = mod.createDraftErrorHandler;
});

// ============================================
// Helpers
// ============================================

function mockKnownParsedResult() {
  return {
    title: "Not Garden Member",
    message: "You are not a member of this garden",
    parsed: {
      raw: "0x8cb4ae3b",
      name: "NotGardenMember",
      message: "You are not a member of this garden",
      action: "Please join the garden before submitting work",
      isKnown: true,
      recoverable: false,
      suggestedAction: "join-garden",
    },
  };
}

function mockUnknownParsedResult() {
  return {
    title: "Transaction Failed",
    message: "Transaction failed. Please try again.",
    parsed: {
      raw: "0xdeadbeef",
      name: "UnknownError",
      message: "Transaction failed with error code: 0xdeadbeef",
      isKnown: false,
      recoverable: true,
      suggestedAction: "retry",
    },
  };
}

// ============================================
// createMutationErrorHandler
// ============================================

describe("createMutationErrorHandler", () => {
  beforeEach(() => {
    mockParseAndFormatError.mockReturnValue(mockKnownParsedResult());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ------------------------------------------
  // Factory creation
  // ------------------------------------------

  describe("factory creation", () => {
    it("returns a callable function", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test operation",
      });
      expect(typeof handler).toBe("function");
    });
  });

  // ------------------------------------------
  // Known error handling
  // ------------------------------------------

  describe("known error handling", () => {
    it("shows toast with known error title and message", () => {
      const handler = createMutationErrorHandler({
        source: "useWorkMutation",
        toastContext: "work upload",
        toastId: "work-upload",
      });

      const error = new Error("0x8cb4ae3b");
      handler(error);

      expect(mockToastError).toHaveBeenCalledOnce();
      expect(mockToastError.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          id: "work-upload",
          title: "Not Garden Member",
          message: "You are not a member of this garden",
          context: "work upload",
        })
      );
    });

    it("returns parsed error result", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
      });

      const result = handler(new Error("test"));

      expect(result.parsed).toBeDefined();
      expect(result.parsed.name).toBe("NotGardenMember");
      expect(result.title).toBe("Not Garden Member");
      expect(result.message).toBe("You are not a member of this garden");
    });

    it("includes action as description for known errors", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
      });

      handler(new Error("test"));

      const toastArg = mockToastError.mock.calls[0][0];
      expect(toastArg.description).toBe("Please join the garden before submitting work");
    });
  });

  // ------------------------------------------
  // Unknown error handling
  // ------------------------------------------

  describe("unknown error handling", () => {
    beforeEach(() => {
      mockParseAndFormatError.mockReturnValue(mockUnknownParsedResult());
    });

    it("uses default fallback message for unknown errors", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test operation",
      });

      handler(new Error("0xdeadbeef"));

      const toastArg = mockToastError.mock.calls[0][0];
      expect(toastArg.message).toBe("Transaction failed. Please try again.");
    });

    it("uses custom fallback message when provided", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        getFallbackMessage: (authMode) =>
          authMode === "passkey" ? "Passkey failed" : "Wallet failed",
      });

      handler(new Error("unknown"), { authMode: "passkey" });

      const toastArg = mockToastError.mock.calls[0][0];
      expect(toastArg.message).toBe("Passkey failed");
    });

    it("uses custom fallback description when provided", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        getFallbackDescription: () => "Try reconnecting",
      });

      handler(new Error("unknown"));

      const toastArg = mockToastError.mock.calls[0][0];
      expect(toastArg.description).toBe("Try reconnecting");
    });

    it("capitalizes toast context for unknown error title", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "work upload",
      });

      handler(new Error("unknown"));

      const toastArg = mockToastError.mock.calls[0][0];
      expect(toastArg.title).toBe("Work upload failed");
    });
  });

  // ------------------------------------------
  // Analytics tracking
  // ------------------------------------------

  describe("analytics tracking", () => {
    it("calls trackError callback when provided", () => {
      const trackError = vi.fn();
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        trackError,
      });

      handler(new Error("test"), {
        gardenAddress: "0x123",
        authMode: "wallet",
      });

      expect(trackError).toHaveBeenCalledOnce();
      expect(trackError).toHaveBeenCalledWith(
        "You are not a member of this garden",
        expect.objectContaining({
          gardenAddress: "0x123",
          authMode: "wallet",
        })
      );
    });

    it("uses Error.message for tracking when parsed message is empty", () => {
      mockParseAndFormatError.mockReturnValue({
        ...mockUnknownParsedResult(),
        parsed: { ...mockUnknownParsedResult().parsed, message: "" },
      });

      const trackError = vi.fn();
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        trackError,
      });

      handler(new Error("Original error message"));

      expect(trackError.mock.calls[0][0]).toBe("Original error message");
    });

    it("always calls trackContractError for error dashboard", () => {
      const handler = createMutationErrorHandler({
        source: "useWorkMutation",
        toastContext: "work upload",
      });

      const error = new Error("test");
      handler(error, { authMode: "wallet", gardenAddress: "0xABC" });

      expect(mockTrackContractError).toHaveBeenCalledOnce();
      expect(mockTrackContractError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          source: "useWorkMutation",
          gardenAddress: "0xABC",
          authMode: "wallet",
          userAction: "work upload",
        })
      );
    });

    it("includes custom metadata in tracking", () => {
      const trackError = vi.fn();
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        trackError,
      });

      handler(new Error("test"), {
        metadata: { actionUID: 42, imageCount: 3 },
      });

      expect(trackError.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          actionUID: 42,
          imageCount: 3,
        })
      );
    });
  });

  // ------------------------------------------
  // Wallet progress toast
  // ------------------------------------------

  describe("wallet progress toast", () => {
    it("uses walletProgressToasts.error in wallet mode when configured", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        useWalletProgressToast: true,
      });

      handler(new Error("test"), { authMode: "wallet" });

      expect(mockWalletProgressError).toHaveBeenCalledOnce();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("uses standard toast when not in wallet mode", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        useWalletProgressToast: true,
      });

      handler(new Error("test"), { authMode: "passkey" });

      expect(mockToastError).toHaveBeenCalledOnce();
      expect(mockWalletProgressError).not.toHaveBeenCalled();
    });

    it("uses standard toast when useWalletProgressToast is false", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        useWalletProgressToast: false,
      });

      handler(new Error("test"), { authMode: "wallet" });

      expect(mockToastError).toHaveBeenCalledOnce();
      expect(mockWalletProgressError).not.toHaveBeenCalled();
    });

    it("passes recoverable flag to wallet progress toast", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
        useWalletProgressToast: true,
      });

      handler(new Error("test"), { authMode: "wallet" });

      // mockKnownParsedResult has recoverable: false
      expect(mockWalletProgressError.mock.calls[0][1]).toBe(false);
    });
  });

  // ------------------------------------------
  // Debug logging
  // ------------------------------------------

  describe("debug logging", () => {
    it("calls debugError when DEBUG_ENABLED is true", () => {
      const handler = createMutationErrorHandler({
        source: "useWorkMutation",
        toastContext: "work upload",
      });

      handler(new Error("test"), {
        gardenAddress: "0x123",
        authMode: "passkey",
      });

      expect(mockDebugError).toHaveBeenCalledOnce();
      expect(mockDebugError.mock.calls[0][0]).toContain("[useWorkMutation] work upload failed");
    });
  });

  // ------------------------------------------
  // Context defaults
  // ------------------------------------------

  describe("context defaults", () => {
    it("works without context argument", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
      });

      // Should not throw when called without context
      const result = handler(new Error("test"));
      expect(result).toBeDefined();
    });

    it("handles null gardenAddress in tracking", () => {
      const handler = createMutationErrorHandler({
        source: "useTest",
        toastContext: "test",
      });

      handler(new Error("test"), { gardenAddress: null });

      expect(mockTrackContractError.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          gardenAddress: undefined,
        })
      );
    });
  });
});

// ============================================
// createDraftErrorHandler
// ============================================

describe("createDraftErrorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a callable function", () => {
    const handler = createDraftErrorHandler("create");
    expect(typeof handler).toBe("function");
  });

  it("shows toast with action in title", () => {
    const handler = createDraftErrorHandler("create");
    handler(new Error("DB write failed"));

    expect(mockToastError).toHaveBeenCalledOnce();
    expect(mockToastError.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        title: "Failed to create draft",
        context: "draft create",
      })
    );
  });

  it("uses Error.message as toast message", () => {
    const handler = createDraftErrorHandler("update");
    handler(new Error("Conflict detected"));

    expect(mockToastError.mock.calls[0][0].message).toBe("Conflict detected");
  });

  it("uses fallback message for non-Error objects", () => {
    const handler = createDraftErrorHandler("delete");
    handler("string error");

    expect(mockToastError.mock.calls[0][0].message).toBe("Please try again.");
  });

  it("uses fallback message for null error", () => {
    const handler = createDraftErrorHandler("save");
    handler(null);

    expect(mockToastError.mock.calls[0][0].message).toBe("Please try again.");
  });

  it("passes original error in toast payload", () => {
    const error = new Error("Original");
    const handler = createDraftErrorHandler("create");
    handler(error);

    expect(mockToastError.mock.calls[0][0].error).toBe(error);
  });
});
