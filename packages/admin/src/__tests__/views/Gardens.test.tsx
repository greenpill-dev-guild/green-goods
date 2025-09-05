import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Gardens from "@/views/Gardens";

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

// Mock CreateGardenModal component
vi.mock("@/components/Garden/CreateGardenModal", () => ({
  CreateGardenModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? React.createElement("div", { "data-testid": "create-garden-modal" },
      React.createElement("button", { onClick: onClose }, "Close Modal")
    ) : null,
}));

describe("Gardens View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display loading state while fetching gardens", () => {
    mockUseRole.mockReturnValue({
      isAdmin: true,
      operatorGardens: [],
    });
    mockUseQuery.mockReturnValue([
      {
        data: null,
        fetching: true,
        error: null,
      },
    ]);

    render(<Gardens />);

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByText("Test Garden")).not.toBeInTheDocument();
  });

  it("should display error state when query fails", () => {
    mockUseRole.mockReturnValue({
      isAdmin: true,
      operatorGardens: [],
    });
    mockUseQuery.mockReturnValue([
      {
        data: null,
        fetching: false,
        error: { message: "Network error" },
      },
    ]);

    render(<Gardens />);

    expect(screen.getByText("Failed to load gardens: Network error")).toBeInTheDocument();
    expect(screen.queryByText("Test Garden")).not.toBeInTheDocument();
  });

  it("should display all gardens for admin users", () => {
    mockUseRole.mockReturnValue({
      isAdmin: true,
      operatorGardens: [],
    });
    mockUseQuery.mockReturnValue([
      {
        data: {
          gardens: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "Admin Garden 1",
              description: "First admin garden",
              location: "Location 1",
              gardeners: ["0x123"],
              operators: ["0x456"],
            },
            {
              id: "0x2345678901234567890123456789012345678901",
              name: "Admin Garden 2",
              description: "Second admin garden",
              location: "Location 2",
              gardeners: ["0x789"],
              operators: ["0xabc"],
            },
          ],
        },
        fetching: false,
        error: null,
      },
    ]);

    render(<Gardens />);

    expect(screen.getByText("Admin Garden 1")).toBeInTheDocument();
    expect(screen.getByText("Admin Garden 2")).toBeInTheDocument();
    expect(screen.getByText("First admin garden")).toBeInTheDocument();
    expect(screen.getByText("Second admin garden")).toBeInTheDocument();
  });

  it("should display only operator gardens for operator users", () => {
    mockUseRole.mockReturnValue({
      isAdmin: false,
      operatorGardens: [
        {
          id: "0x2345678901234567890123456789012345678901",
          name: "Operator Garden",
          description: "Garden managed by operator",
          location: "Operator Location",
          gardeners: ["0x789"],
          operators: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
        },
      ],
    });
    mockUseQuery.mockReturnValue([
      {
        data: {
          gardens: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "Admin Garden",
              description: "Admin only garden",
              location: "Admin Location",
              gardeners: ["0x123"],
              operators: ["0x456"],
            },
          ],
        },
        fetching: false,
        error: null,
      },
    ]);

    render(<Gardens />);

    // Should only see operator garden, not admin garden
    expect(screen.getByText("Operator Garden")).toBeInTheDocument();
    expect(screen.queryByText("Admin Garden")).not.toBeInTheDocument();
  });

  it("should show create garden button for admin users", () => {
    mockUseRole.mockReturnValue({
      isAdmin: true,
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

    expect(screen.getByText("Create Garden")).toBeInTheDocument();
  });

  it("should open create garden modal when button is clicked", async () => {
    const user = userEvent.setup();
    mockUseRole.mockReturnValue({
      isAdmin: true,
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

    const createButton = screen.getByText("Create Garden");
    await user.click(createButton);

    expect(screen.getByTestId("create-garden-modal")).toBeInTheDocument();
  });

  it("should close create garden modal when close is clicked", async () => {
    const user = userEvent.setup();
    mockUseRole.mockReturnValue({
      isAdmin: true,
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

    // Open modal
    const createButton = screen.getByText("Create Garden");
    await user.click(createButton);
    expect(screen.getByTestId("create-garden-modal")).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByText("Close Modal");
    await user.click(closeButton);
    
    await waitFor(() => {
      expect(screen.queryByTestId("create-garden-modal")).not.toBeInTheDocument();
    });
  });

  it("should display empty state when no gardens are available", () => {
    mockUseRole.mockReturnValue({
      isAdmin: true,
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

    expect(screen.getByText("No gardens")).toBeInTheDocument();
  });
});
