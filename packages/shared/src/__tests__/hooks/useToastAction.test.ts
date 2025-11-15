import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { createElement, type ReactNode } from "react";
import { useToastAction } from "@/hooks/useToastAction";
import { toastService } from "@/toast";
import enMessages from "@/i18n/en.json";

vi.mock("@/toast", () => ({
  toastService: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useToastAction", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    createElement(IntlProvider, { locale: "en", messages: enMessages }, children)
  );

  beforeEach(() => {
    vi.clearAllMocks();
    (toastService.loading as any).mockReturnValue("toast-id");
  });

  it("should execute action successfully with toast feedback", async () => {
    const { result } = renderHook(() => useToastAction(), { wrapper });
    const mockAction = vi.fn(() => Promise.resolve("success-result"));

    await act(async () => {
      const actionResult = await result.current.executeWithToast(mockAction, {
        loadingMessage: "Processing...",
        successMessage: "Action completed!",
        errorMessage: "Action failed!",
      });

      expect(actionResult).toBe("success-result");
    });

    expect(toastService.loading).toHaveBeenCalledWith({
      message: "Processing...",
      title: undefined,
      context: undefined,
      suppressLogging: true,
    });
    expect(toastService.success).toHaveBeenCalledWith({
      id: "toast-id",
      message: "Action completed!",
      title: undefined,
      context: undefined,
      duration: 3000,
      suppressLogging: true,
    });
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it("should handle action failure with error toast", async () => {
    const { result } = renderHook(() => useToastAction(), { wrapper });
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

    expect(toastService.loading).toHaveBeenCalledWith({
      message: "Processing...",
      title: undefined,
      context: undefined,
      suppressLogging: true,
    });
    expect(toastService.error).toHaveBeenCalledWith({
      id: "toast-id",
      message: "Action failed!",
      title: undefined,
      context: undefined,
      duration: 4500,
      error,
      suppressLogging: undefined,
    });
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it("should use default messages when not provided", async () => {
    const { result } = renderHook(() => useToastAction(), { wrapper });
    const mockAction = vi.fn(() => Promise.resolve("result"));

    await act(async () => {
      await result.current.executeWithToast(mockAction);
    });

    expect(toastService.loading).toHaveBeenCalledWith({
      message: "Processing...",
      title: undefined,
      context: undefined,
      suppressLogging: true,
    });
    expect(toastService.success).toHaveBeenCalledWith({
      id: "toast-id",
      message: "Action completed successfully",
      title: undefined,
      context: undefined,
      duration: 3000,
      suppressLogging: true,
    });
  });

  it("should use custom duration when provided", async () => {
    const { result } = renderHook(() => useToastAction(), { wrapper });
    const mockAction = vi.fn(() => Promise.resolve("result"));

    await act(async () => {
      await result.current.executeWithToast(mockAction, {
        duration: 5000,
      });
    });

    expect(toastService.success).toHaveBeenCalledWith({
      id: "toast-id",
      message: "Action completed successfully",
      title: undefined,
      context: undefined,
      duration: 5000,
      suppressLogging: true,
    });
  });

  it("should handle non-Error exceptions", async () => {
    const { result } = renderHook(() => useToastAction(), { wrapper });
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

    expect(toastService.error).toHaveBeenCalledWith({
      id: "toast-id",
      message: "Custom error message",
      title: undefined,
      context: undefined,
      duration: 4500,
      error: "string error",
      suppressLogging: undefined,
    });
  });
});
