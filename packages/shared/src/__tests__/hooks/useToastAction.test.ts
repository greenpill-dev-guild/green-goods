import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToastAction } from "@/hooks/useToastAction";
import toast from "react-hot-toast";

// Mock toast
vi.mock("react-hot-toast");

describe("useToastAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (toast.loading as any).mockReturnValue("toast-id");
  });

  it("should execute action successfully with toast feedback", async () => {
    const { result } = renderHook(() => useToastAction());
    const mockAction = vi.fn(() => Promise.resolve("success-result"));

    await act(async () => {
      const actionResult = await result.current.executeWithToast(mockAction, {
        loadingMessage: "Processing...",
        successMessage: "Action completed!",
        errorMessage: "Action failed!",
      });

      expect(actionResult).toBe("success-result");
    });

    expect(toast.loading).toHaveBeenCalledWith("Processing...");
    expect(toast.success).toHaveBeenCalledWith("Action completed!", {
      id: "toast-id",
      duration: 3000,
    });
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it("should handle action failure with error toast", async () => {
    const { result } = renderHook(() => useToastAction());
    const error = new Error("Something went wrong");
    const mockAction = vi.fn(() => Promise.reject(error));

    await act(async () => {
      try {
        await result.current.executeWithToast(mockAction, {
          loadingMessage: "Processing...",
          successMessage: "Action completed!",
          errorMessage: "Action failed!",
        });
      } catch (e) {
        expect(e).toBe(error);
      }
    });

    expect(toast.loading).toHaveBeenCalledWith("Processing...");
    expect(toast.error).toHaveBeenCalledWith("Something went wrong", {
      id: "toast-id",
      duration: 4500,
    });
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it("should use default messages when not provided", async () => {
    const { result } = renderHook(() => useToastAction());
    const mockAction = vi.fn(() => Promise.resolve("result"));

    await act(async () => {
      await result.current.executeWithToast(mockAction);
    });

    expect(toast.loading).toHaveBeenCalledWith("Processing...");
    expect(toast.success).toHaveBeenCalledWith("Action completed successfully", {
      id: "toast-id",
      duration: 3000,
    });
  });

  it("should use custom duration when provided", async () => {
    const { result } = renderHook(() => useToastAction());
    const mockAction = vi.fn(() => Promise.resolve("result"));

    await act(async () => {
      await result.current.executeWithToast(mockAction, {
        duration: 5000,
      });
    });

    expect(toast.success).toHaveBeenCalledWith("Action completed successfully", {
      id: "toast-id",
      duration: 5000,
    });
  });

  it("should handle non-Error exceptions", async () => {
    const { result } = renderHook(() => useToastAction());
    const mockAction = vi.fn(() => Promise.reject("string error"));

    await act(async () => {
      try {
        await result.current.executeWithToast(mockAction, {
          errorMessage: "Custom error message",
        });
      } catch (e) {
        expect(e).toBe("string error");
      }
    });

    expect(toast.error).toHaveBeenCalledWith("Custom error message", {
      id: "toast-id",
      duration: 4500,
    });
  });
});
