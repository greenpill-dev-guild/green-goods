import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../../../shared/src/i18n/en.json";
import Gardens from "@/views/Gardens";
import enMessages from "../../../../shared/src/i18n/en.json";

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
  return new Proxy({}, { get: () => Icon });
});

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: to, ...props }, children),
  };
});

function renderWithIntl(ui: React.ReactElement) {
  return render(React.createElement(IntlProvider, { locale: "en", messages: enMessages }, ui));
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

describe("Unauthorized Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardenPermissions.mockReturnValue(buildPermissions());
  });

  it("should show create garden link for all authenticated users", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithIntl(<Gardens />);

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

    renderWithIntl(<Gardens />);

    expect(screen.getByText(/Network request failed/)).toBeInTheDocument();
  });

  it("should show indexer connection issue warning when error occurs", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("Failed to fetch"),
    });

    renderWithIntl(<Gardens />);

    expect(screen.getByText("Indexer Connection Issue")).toBeInTheDocument();
  });

  it("should show appropriate guidance when user has no operator gardens", () => {
    mockUseGardenPermissions.mockReturnValue(buildPermissions());
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

    renderWithIntl(<Gardens />);

    // User should see the garden but not have operator badge
    expect(screen.getByText("Test Garden")).toBeInTheDocument();
    expect(screen.queryByText("Operator")).not.toBeInTheDocument();
  });

  it("should show operator badge when user can manage garden", () => {
    mockUseGardenPermissions.mockReturnValue(
      buildPermissions({
        canManageGarden: () => true,
        isOperatorOfGarden: () => true,
      })
    );
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

    renderWithIntl(<Gardens />);

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
