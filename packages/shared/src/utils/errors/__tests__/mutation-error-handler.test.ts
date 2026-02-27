/**
 * Mutation Error Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../../../components/toast", () => ({
  toastService: {
    error: vi.fn(),
    show: vi.fn(),
  },
  walletProgressToasts: {
    error: vi.fn(),
  },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackContractError: vi.fn(),
}));

vi.mock("../../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugError: vi.fn(),
}));

import { createMutationErrorHandler, createDraftErrorHandler } from "../mutation-error-handler";
import { toastService, walletProgressToasts } from "../../../components/toast";
import { trackContractError } from "../../../modules/app/error-tracking";

describe("createMutationErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a callable error handler", () => {
    const handler = createMutationErrorHandler({
      source: "useTestHook",
      toastContext: "test operation",
    });
    expect(typeof handler).toBe("function");
  });

  it("returns parsed error result", () => {
    const handler = createMutationErrorHandler({
      source: "useTestHook",
      toastContext: "test operation",
    });
    const result = handler(new Error("Something went wrong"));

    expect(result).toHaveProperty("parsed");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("message");
  });

  describe("error tracking", () => {
    it("calls trackContractError with error and context", () => {
      const handler = createMutationErrorHandler({
        source: "useWorkMutation",
        toastContext: "work upload",
      });

      const error = new Error("0x8cb4ae3b");
      handler(error, { gardenAddress: "0x123", authMode: "passkey" });

      expect(trackContractError).toHaveBeenCalledWith(error, {
        source: "useWorkMutation",
        gardenAddress: "0x123",
        authMode: "passkey",
        userAction: "work upload",
        metadata: {
          parsedErrorName: expect.any(String),
          isKnown: expect.any(Boolean),
        },
      });
    });

    it("calls custom trackError function when provided", () => {
      const trackError = vi.fn();
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
        trackError,
      });

      handler(new Error("test error"), {
        gardenAddress: "0xGarden",
        authMode: "wallet",
        metadata: { extra: "data" },
      });

      expect(trackError).toHaveBeenCalledWith(expect.any(String), {
        gardenAddress: "0xGarden",
        authMode: "wallet",
        extra: "data",
      });
    });

    it("does not call custom trackError when not provided", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
      });

      // Should not throw even without trackError
      expect(() => handler(new Error("test"))).not.toThrow();
    });
  });

  describe("toast notifications", () => {
    it("shows error toast with toastService by default", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test operation",
        toastId: "test-toast",
      });

      handler(new Error("Something failed"));

      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-toast",
          context: "test operation",
        })
      );
    });

    it("shows walletProgressToasts when useWalletProgressToast is true and authMode is wallet", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
        useWalletProgressToast: true,
      });

      handler(new Error("test error"), { authMode: "wallet" });

      expect(walletProgressToasts.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Boolean)
      );
      expect(toastService.error).not.toHaveBeenCalled();
    });

    it("falls back to toastService when useWalletProgressToast is true but authMode is passkey", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
        useWalletProgressToast: true,
      });

      handler(new Error("test error"), { authMode: "passkey" });

      expect(toastService.error).toHaveBeenCalled();
      expect(walletProgressToasts.error).not.toHaveBeenCalled();
    });

    it("uses known error message for recognized contract errors", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "work submission",
      });

      // 0x8cb4ae3b = NotGardenMember (legacy selector)
      const result = handler("0x8cb4ae3b");

      expect(result.parsed.isKnown).toBe(true);
      expect(result.message).toContain("not a member");
    });

    it("uses fallback message for unknown errors when getFallbackMessage is provided", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
        getFallbackMessage: (authMode) =>
          authMode === "wallet" ? "Wallet error" : "Passkey error",
      });

      const result = handler(new Error("unknown error xyz"), {
        authMode: "wallet",
      });

      expect(result.parsed.isKnown).toBe(false);
      expect(result.message).toBe("Wallet error");
    });

    it("uses default fallback message when no getFallbackMessage provided", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
      });

      const result = handler(new Error("unknown error xyz"));

      expect(result.message).toBe("Transaction failed. Please try again.");
    });

    it("capitalizes toastContext for display title on unknown errors", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "work upload",
      });

      const result = handler(new Error("unknown xyz"));

      expect(result.title).toBe("Work upload failed");
    });

    it("passes getFallbackDescription for unknown errors", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
        getFallbackDescription: () => "Try again later",
      });

      handler(new Error("unknown xyz"));

      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Try again later",
        })
      );
    });

    it("does not show a toast when showToast is false", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test operation",
      });

      handler(new Error("Something failed"), { showToast: false });

      expect(toastService.error).not.toHaveBeenCalled();
      expect(walletProgressToasts.error).not.toHaveBeenCalled();
      expect(trackContractError).toHaveBeenCalled();
    });
  });

  describe("context handling", () => {
    it("handles empty context", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
      });

      expect(() => handler(new Error("test"))).not.toThrow();
    });

    it("handles null gardenAddress in context", () => {
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
      });

      expect(() => handler(new Error("test"), { gardenAddress: null })).not.toThrow();

      // gardenAddress should be converted to undefined for trackContractError
      expect(trackContractError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          gardenAddress: undefined,
        })
      );
    });

    it("merges additional metadata", () => {
      const trackError = vi.fn();
      const handler = createMutationErrorHandler({
        source: "useTestHook",
        toastContext: "test",
        trackError,
      });

      handler(new Error("test"), {
        metadata: { actionUID: 1, imageCount: 3 },
      });

      expect(trackError).toHaveBeenCalledWith(expect.any(String), {
        gardenAddress: undefined,
        authMode: undefined,
        actionUID: 1,
        imageCount: 3,
      });
    });
  });
});

describe("createDraftErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a callable error handler", () => {
    const handler = createDraftErrorHandler("create");
    expect(typeof handler).toBe("function");
  });

  it("shows error toast with action name", () => {
    const handler = createDraftErrorHandler("create");
    handler(new Error("database error"));

    expect(toastService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed to create draft",
        context: "draft create",
      })
    );
  });

  it("extracts message from Error instances", () => {
    const handler = createDraftErrorHandler("update");
    handler(new Error("field validation failed"));

    expect(toastService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "field validation failed",
      })
    );
  });

  it("uses fallback message for non-Error values", () => {
    const handler = createDraftErrorHandler("delete");
    handler("string error");

    expect(toastService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Please try again.",
      })
    );
  });

  it("uses fallback message for null", () => {
    const handler = createDraftErrorHandler("save");
    handler(null);

    expect(toastService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed to save draft",
        message: "Please try again.",
      })
    );
  });

  it("passes the error object through", () => {
    const handler = createDraftErrorHandler("create");
    const error = new Error("test");
    handler(error);

    expect(toastService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
      })
    );
  });
});
