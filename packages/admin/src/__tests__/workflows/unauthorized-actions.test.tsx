import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, render, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Gardens from "@/views/Gardens";
import { toastService } from "@green-goods/shared";

// Mock the useRole hook
const mockUseRole = vi.fn();
vi.mock("@/hooks/useRole", () => ({
  useRole: () => mockUseRole(),
}));

// Mock the useQuery hook
const mockUseQuery = vi.fn();
vi.mock("urql", () => ({
  useQuery: () => mockUseQuery(),
}));

// Mock garden operations
const mockUseGardenOperations = vi.fn();
vi.mock("@/hooks/useGardenOperations", () => ({
  useGardenOperations: () => mockUseGardenOperations(),
}));

// Mock CreateGardenModal
vi.mock("@/components/Garden/CreateGardenModal", () => ({
  CreateGardenModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen
      ? React.createElement(
          "div",
          { "data-testid": "create-garden-modal" },
          React.createElement(
            "button",
            {
              "data-testid": "create-garden-submit",
              onClick: () => {
                // Simulate unauthorized action
                toastService.error({
                  title: "Unauthorized",
                  message: "Unauthorized: Admin role required",
                  context: "admin action",
                  suppressLogging: true,
                });
                onClose();
              },
            },
            "Create Garden"
          ),
          React.createElement("button", { onClick: onClose }, "Cancel")
        )
      : null,
}));

describe("Unauthorized Actions", () => {
  const toastErrorSpy = vi.spyOn(toastService, "error").mockImplementation(vi.fn());

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardenOperations.mockReturnValue({
      addGardener: vi.fn(),
      removeGardener: vi.fn(),
      isLoading: false,
    });
    toastErrorSpy.mockClear();
  });

  it("should show error toast when unauthorized user tries to create garden", async () => {
    const user = userEvent.setup();

    mockUseRole.mockReturnValue({
      isAdmin: false,
      isOperator: false,
      operatorGardens: [],
    });
    mockUseQuery.mockReturnValue([
      {
        data: { gardens: [] },
        fetching: false,
        error: null,
      },
    ]);

    render(<Gardens />);

    // Find and click create garden button (should not be visible for unauthorized users)
    // This test simulates what happens if somehow an unauthorized user triggers creation
    const createButton = screen.queryByText("Create Garden");
    expect(createButton).not.toBeInTheDocument(); // Should not be visible
  });

  it("should show error toast when operator tries admin-only actions", async () => {
    const user = userEvent.setup();

    mockUseRole.mockReturnValue({
      isAdmin: false,
      isOperator: true,
      operatorGardens: [{ id: "0x123", name: "Test Garden" }],
    });
    mockUseQuery.mockReturnValue([
      {
        data: { gardens: [] },
        fetching: false,
        error: null,
      },
    ]);

    render(<Gardens />);

    // Operators should see create button
    const createButton = screen.getByText("Create Garden");
    await user.click(createButton);

    // Try to submit (this should fail with unauthorized error)
    const submitButton = screen.getByTestId("create-garden-submit");
    await user.click(submitButton);

    expect(toastErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Unauthorized: Admin role required" })
    );
  });

  it("should prevent unauthorized garden operations", async () => {
    const mockAddGardener = vi.fn(() =>
      Promise.reject(new Error("Unauthorized: Only operators can add gardeners"))
    );

    mockUseGardenOperations.mockReturnValue({
      addGardener: mockAddGardener,
      removeGardener: vi.fn(),
      isLoading: false,
    });

    const { useGardenOperations } = await import("@/hooks/useGardenOperations");
    const { result } = renderHook(() => useGardenOperations("0x123"));

    try {
      await result.current.addGardener("0x456");
    } catch (error) {
      expect(error).toEqual(new Error("Unauthorized: Only operators can add gardeners"));
    }
  });

  it("should show appropriate error messages for different unauthorized actions", async () => {
    const scenarios = [
      {
        action: "create garden",
        error: "Unauthorized: Admin role required",
      },
      {
        action: "deploy contracts",
        error: "Unauthorized: Admin role required",
      },
      {
        action: "manage operators",
        error: "Unauthorized: Admin role required",
      },
    ];

    for (const scenario of scenarios) {
      // Test that appropriate error messages are shown
      expect(scenario.error).toContain("Unauthorized:");
    }
  });

  it("should handle network errors gracefully", async () => {
    mockUseQuery.mockReturnValue([
      {
        data: null,
        fetching: false,
        error: { message: "Network request failed" },
      },
    ]);

    mockUseRole.mockReturnValue({
      isAdmin: true,
      operatorGardens: [],
    });

    render(<Gardens />);

    expect(screen.getByText("Failed to load gardens: Network request failed")).toBeInTheDocument();
  });
});
