import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Gardens from "@/views/Gardens";

// Mock the shared barrel — Gardens imports from @green-goods/shared directly
const mockUseGardens = vi.fn();
const mockUseGardenPermissions = vi.fn();
vi.mock("@green-goods/shared", () => ({
  useGardens: () => mockUseGardens(),
  useGardenPermissions: () => mockUseGardenPermissions(),
  resolveIPFSUrl: (url: string) => url,
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// Mock @remixicon/react icons used by Gardens and PageHeader
vi.mock("@remixicon/react", () => {
  const Icon = (props: any) => React.createElement("span", props);
  return {
    RiAddLine: Icon,
    RiEyeLine: Icon,
    RiPlantLine: Icon,
    RiShieldCheckLine: Icon,
    RiUserLine: Icon,
    RiVipCrownLine: Icon,
    RiArrowLeftLine: Icon,
  };
});

// Mock react-router-dom Link
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: to, ...props }, children),
  };
});

function renderWithIntl(ui: React.ReactElement) {
  return render(React.createElement(IntlProvider, { locale: "en", messages: {} }, ui));
}

function buildPermissions(overrides: Record<string, any> = {}) {
  return {
    canManageGarden: () => false,
    isOwnerOfGarden: () => false,
    isOperatorOfGarden: () => false,
    isEvaluatorOfGarden: () => false,
    ...overrides,
  };
}

describe("Gardens View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardenPermissions.mockReturnValue(buildPermissions());
  });

  it("should display loading state while fetching gardens", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    renderWithIntl(<Gardens />);

    // The component shows skeleton cards during loading, not a specific spinner
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("Test Garden")).not.toBeInTheDocument();
  });

  it("should display error state when query fails", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("Network error"),
    });

    renderWithIntl(<Gardens />);

    expect(screen.getByText(/Network error/)).toBeInTheDocument();
    expect(screen.queryByText("Test Garden")).not.toBeInTheDocument();
  });

  it("should display all gardens for admin users", () => {
    mockUseGardens.mockReturnValue({
      data: [
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
      isLoading: false,
      error: null,
    });

    renderWithIntl(<Gardens />);

    expect(screen.getByText("Admin Garden 1")).toBeInTheDocument();
    expect(screen.getByText("Admin Garden 2")).toBeInTheDocument();
    expect(screen.getByText("First admin garden")).toBeInTheDocument();
    expect(screen.getByText("Second admin garden")).toBeInTheDocument();
  });

  it("should display gardens with operator badge for managed gardens", () => {
    mockUseGardenPermissions.mockReturnValue(
      buildPermissions({
        canManageGarden: (garden: { id: string }) =>
          garden.id === "0x2345678901234567890123456789012345678901",
        isOperatorOfGarden: (garden: { id: string }) =>
          garden.id === "0x2345678901234567890123456789012345678901",
      })
    );
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "0x1234567890123456789012345678901234567890",
          name: "Admin Garden",
          description: "Admin only garden",
          location: "Admin Location",
          gardeners: ["0x123"],
          operators: ["0x456"],
        },
        {
          id: "0x2345678901234567890123456789012345678901",
          name: "Operator Garden",
          description: "Garden managed by operator",
          location: "Operator Location",
          gardeners: ["0x789"],
          operators: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
        },
      ],
      isLoading: false,
      error: null,
    });

    renderWithIntl(<Gardens />);

    // Both gardens should be visible (Gardens view shows all gardens, permissions show badge)
    expect(screen.getByText("Admin Garden")).toBeInTheDocument();
    expect(screen.getByText("Operator Garden")).toBeInTheDocument();
  });

  it("should show create garden button", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithIntl(<Gardens />);

    expect(screen.getByText("Create Garden")).toBeInTheDocument();
  });

  it("should link to create garden page when button is clicked", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithIntl(<Gardens />);

    const createButton = screen.getByText("Create Garden");
    expect(createButton.closest("a")).toHaveAttribute("href", "/gardens/create");
  });

  it("should display empty state when no gardens are available", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithIntl(<Gardens />);

    expect(screen.getByText("No gardens yet")).toBeInTheDocument();
  });
});
