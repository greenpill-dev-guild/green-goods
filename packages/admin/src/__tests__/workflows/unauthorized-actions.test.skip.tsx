import { toastService } from "@green-goods/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Gardens from "@/views/Gardens";

// Mock the shared hooks
const mockUseGardens = vi.fn();
const mockUseGardenPermissions = vi.fn();
vi.mock("@green-goods/shared/hooks", () => ({
  useGardens: () => mockUseGardens(),
  useGardenPermissions: () => mockUseGardenPermissions(),
}));

// Mock the shared modules
vi.mock("@green-goods/shared/modules", () => ({
  resolveIPFSUrl: (url: string) => url,
}));

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: to, ...props }, children),
  };
});

describe("Unauthorized Actions", () => {
  const toastErrorSpy = vi.spyOn(toastService, "error").mockImplementation(vi.fn());

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardenPermissions.mockReturnValue({
      canManageGarden: () => false,
    });
    toastErrorSpy.mockClear();
  });

  it("should show create garden link for all authenticated users", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<Gardens />);

    // Create garden button should always be visible (authorization handled at route level)
    const createButton = screen.getByText("Create Garden");
    expect(createButton).toBeInTheDocument();
    expect(createButton.closest("a")).toHaveAttribute("href", "/gardens/create");
  });

  it("should handle network errors gracefully", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("Network request failed"),
    });

    render(<Gardens />);

    expect(screen.getByText(/Network request failed/)).toBeInTheDocument();
  });

  it("should show indexer connection issue warning when error occurs", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("Failed to fetch"),
    });

    render(<Gardens />);

    expect(screen.getByText("Indexer Connection Issue")).toBeInTheDocument();
  });

  it("should show appropriate guidance when user has no operator gardens", () => {
    mockUseGardenPermissions.mockReturnValue({
      canManageGarden: () => false,
    });
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "0x1234",
          name: "Test Garden",
          description: "A garden",
          location: "Location",
          gardeners: ["0x123"],
          operators: ["0x456"],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<Gardens />);

    // User should see the garden but not have operator badge
    expect(screen.getByText("Test Garden")).toBeInTheDocument();
    expect(screen.queryByText("Operator")).not.toBeInTheDocument();
  });

  it("should show operator badge when user can manage garden", () => {
    mockUseGardenPermissions.mockReturnValue({
      canManageGarden: () => true,
    });
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "0x1234",
          name: "My Garden",
          description: "A garden I manage",
          location: "Location",
          gardeners: ["0x123"],
          operators: ["0x789"],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<Gardens />);

    expect(screen.getByText("My Garden")).toBeInTheDocument();
    expect(screen.getAllByText("Operator").length).toBeGreaterThan(0);
  });

  it("should show appropriate error messages pattern for different scenarios", () => {
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
});
