/**
 * TopNav Component Tests
 *
 * Tests for TopNav component focusing on notification visibility based on operator status.
 * Verifies BUG-012: Non-operators should not see the notification bell.
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock hooks
vi.mock("@green-goods/shared/hooks", () => ({
  useOffline: vi.fn(() => ({
    syncStatus: "idle",
    isOnline: true,
  })),
}));

vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// Mock the GardenNotifications component
vi.mock("@/views/Home/Garden/Notifications", async () => {
  const React = await import("react");
  return {
    GardenNotifications: ({ notifications }: any) =>
      React.createElement(
        "div",
        { "data-testid": "garden-notifications" },
        `Notifications: ${notifications?.length ?? 0}`
      ),
  };
});

// Mock Button component
vi.mock("@/components/Actions", async () => {
  const React = await import("react");
  return {
    Button: ({ children, onClick, leadingIcon, ...props }: any) =>
      React.createElement("button", { onClick, ...props }, leadingIcon, children),
  };
});

import { Work } from "@green-goods/shared/types";
import { TopNav } from "../../components/Navigation/TopNav";

// ============================================================================
// Test Data
// ============================================================================

const mockGarden = {
  id: "0xGarden123",
  chainId: 84532,
  tokenAddress: "0xToken456",
  tokenID: 1n,
  name: "Test Garden",
  description: "A test garden",
  location: "Test Location",
  bannerImage: "https://example.com/banner.jpg",
  gardeners: ["0xGardener1", "0xGardener2"],
  operators: ["0xOperator1"],
  createdAt: Date.now(),
};

const mockWorks: Work[] = [
  {
    id: "work-1",
    title: "Test Work 1",
    actionUID: 1,
    gardenerAddress: "0xGardener1",
    gardenAddress: "0xGarden123",
    feedback: "",
    metadata: JSON.stringify({ plantCount: 5, plantSelection: ["tree"] }),
    media: [],
    createdAt: Date.now(),
    status: "pending",
  },
  {
    id: "work-2",
    title: "Test Work 2",
    actionUID: 2,
    gardenerAddress: "0xGardener2",
    gardenAddress: "0xGarden123",
    feedback: "",
    metadata: JSON.stringify({ plantCount: 3, plantSelection: ["flower"] }),
    media: [],
    createdAt: Date.now(),
    status: "approved",
  },
];

// ============================================================================
// Tests
// ============================================================================

describe("components/Navigation/TopNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Notification visibility based on operator status (BUG-012)", () => {
    it("shows notification bell when user is an operator", () => {
      render(
        createElement(TopNav, {
          garden: mockGarden as any,
          works: mockWorks as any,
          isOperator: true,
        })
      );

      // Notification button should be visible
      const notificationButton = document.querySelector('button[class*="dropdown"]');
      expect(notificationButton).toBeInTheDocument();
    });

    it("hides notification bell when user is NOT an operator", () => {
      render(
        createElement(TopNav, {
          garden: mockGarden as any,
          works: mockWorks as any,
          isOperator: false,
        })
      );

      // Notification button should NOT be visible
      const notificationButton = document.querySelector('button[class*="dropdown"]');
      expect(notificationButton).not.toBeInTheDocument();
    });

    it("hides notification bell when isOperator is not provided (defaults to false)", () => {
      render(
        createElement(TopNav, {
          garden: mockGarden as any,
          works: mockWorks as any,
          // isOperator not provided
        })
      );

      // Notification button should NOT be visible (default isOperator = false)
      const notificationButton = document.querySelector('button[class*="dropdown"]');
      expect(notificationButton).not.toBeInTheDocument();
    });

    it("hides notification center even with pending works when not an operator", () => {
      const worksWithPending = [
        ...mockWorks,
        {
          id: "work-3",
          title: "Pending Work",
          status: "pending",
          actionUID: 3,
          gardenerAddress: "0xGardener3",
          gardenAddress: "0xGarden123",
          feedback: "",
          metadata: JSON.stringify({ plantCount: 2, plantSelection: [] }),
          media: [],
          createdAt: Date.now(),
        },
      ];

      render(
        createElement(TopNav, {
          garden: mockGarden as any,
          works: worksWithPending as any,
          isOperator: false,
        })
      );

      // Even with pending works, non-operators should not see notifications
      const notificationButton = document.querySelector('button[class*="dropdown"]');
      expect(notificationButton).not.toBeInTheDocument();
    });

    it("shows notification badge with pending count for operators", () => {
      const worksWithPending = [
        { ...mockWorks[0], status: "pending" },
        { ...mockWorks[1], status: "pending" },
      ];

      render(
        createElement(TopNav, {
          garden: mockGarden as any,
          works: worksWithPending as any,
          isOperator: true,
        })
      );

      // Should show pending count badge
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  describe("Back button", () => {
    it("renders back button when onBackClick is provided", () => {
      const handleBack = vi.fn();

      render(
        createElement(TopNav, {
          onBackClick: handleBack,
        })
      );

      // Back button should be present
      const buttons = document.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("does not render back button when onBackClick is not provided", () => {
      const { container } = render(createElement(TopNav, {}));

      // Should not have any buttons when no back click and no garden
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(0);
    });
  });

  describe("Children rendering", () => {
    it("renders children in the center area", () => {
      render(
        createElement(
          TopNav,
          {},
          createElement("span", { "data-testid": "child-content" }, "Child Content")
        )
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });
  });
});
