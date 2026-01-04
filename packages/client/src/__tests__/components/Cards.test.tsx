/**
 * Card Components Tests
 *
 * Tests for ActionCard, GardenCard, and WorkCard components.
 * Focuses on rendering, props handling, and user interactions.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock hooks
vi.mock("@green-goods/shared/hooks", () => ({
  useEnsName: vi.fn(() => ({ data: null })),
}));

vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  formatAddress: (addr: string, opts?: any) => (opts?.ensName ? opts.ensName : addr?.slice(0, 6)),
  formatFileSize: (size: number) => `${Math.round(size / 1024)}KB`,
  formatRelativeTime: () => "2 hours ago",
  truncateAddress: (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`,
  buildGardenMemberSets: (gardeners: string[], operators: string[]) => ({
    memberIds: new Set([...gardeners, ...operators]),
    operatorIds: new Set(operators),
  }),
}));

vi.mock("@green-goods/shared/components", () => ({
  getStatusColors: (status: string) => ({
    combined: `status-${status}`,
  }),
  StatusBadge: ({ status, size }: { status: string; size?: string }) =>
    createElement("span", { "data-testid": "status-badge", "data-status": status }, status),
}));

import { ActionCard } from "../../components/Cards/Action/ActionCard";
import { GardenCard } from "../../components/Cards/Garden/GardenCard";
import { WorkCard, MinimalWorkCard } from "../../components/Cards/Work/WorkCard";

// Test wrapper with IntlProvider
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) =>
    createElement(IntlProvider, { locale: "en", messages: {} }, children);
};

const Wrapper = createWrapper();

// ============================================================================
// ActionCard Tests
// ============================================================================

describe("components/Cards/ActionCard", () => {
  const mockAction = {
    id: "action-1",
    title: "Plant Trees",
    description: "Help plant trees in the community garden",
    media: ["https://example.com/tree.jpg"],
    mediaInfo: {
      description: "Take photos of your planting work",
    },
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 86400000,
    capitals: ["LIVING"],
    createdAt: Date.now(),
  };

  it("renders action title", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(ActionCard, { action: mockAction, selected: false })
      )
    );

    expect(screen.getByText("Plant Trees")).toBeInTheDocument();
  });

  it("renders media description", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(ActionCard, { action: mockAction, selected: false })
      )
    );

    expect(screen.getByText("Take photos of your planting work")).toBeInTheDocument();
  });

  it("applies selected styles when selected", () => {
    const { container } = render(
      createElement(
        Wrapper,
        null,
        createElement(ActionCard, { action: mockAction, selected: true })
      )
    );

    // Check for selected data attribute
    const selectedDiv = container.querySelector("[data-selected='true']");
    expect(selectedDiv).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(
        Wrapper,
        null,
        createElement(ActionCard, { action: mockAction, selected: false, onClick: handleClick })
      )
    );

    await user.click(screen.getByText("Plant Trees"));
    expect(handleClick).toHaveBeenCalled();
  });
});

// ============================================================================
// GardenCard Tests
// ============================================================================

describe("components/Cards/GardenCard", () => {
  const mockGarden = {
    id: "0xGarden123",
    chainId: 84532,
    tokenAddress: "0xToken456",
    tokenID: 1n,
    name: "Community Garden",
    description: "A beautiful community garden in the city center",
    location: "San Francisco, CA",
    bannerImage: "https://example.com/garden.jpg",
    gardeners: ["0xGardener1", "0xGardener2", "0xGardener3"],
    operators: ["0xOperator1"],
    createdAt: Date.now(),
  };

  it("renders garden name", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(GardenCard, { garden: mockGarden, selected: false })
      )
    );

    expect(screen.getByText("Community Garden")).toBeInTheDocument();
  });

  it("renders garden location", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(GardenCard, { garden: mockGarden, selected: false })
      )
    );

    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
  });

  it("shows member count", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(GardenCard, { garden: mockGarden, selected: false })
      )
    );

    // 3 gardeners + 1 operator = 4 members (deduplicated)
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });

  it("shows operator count when showOperators is false (default)", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(GardenCard, { garden: mockGarden, selected: false })
      )
    );

    // Should show "1 Operators" badge
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it("shows description when showDescription is true", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(GardenCard, { garden: mockGarden, selected: false, showDescription: true })
      )
    );

    expect(screen.getByText("A beautiful community garden in the city center")).toBeInTheDocument();
  });

  it("hides description when showDescription is false", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(GardenCard, { garden: mockGarden, selected: false, showDescription: false })
      )
    );

    expect(
      screen.queryByText("A beautiful community garden in the city center")
    ).not.toBeInTheDocument();
  });

  it("applies selected styles when selected", () => {
    const { container } = render(
      createElement(
        Wrapper,
        null,
        createElement(GardenCard, { garden: mockGarden, selected: true })
      )
    );

    const selectedDiv = container.querySelector("[data-selected='true']");
    expect(selectedDiv).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(
        Wrapper,
        null,
        createElement(GardenCard, { garden: mockGarden, selected: false, onClick: handleClick })
      )
    );

    await user.click(screen.getByText("Community Garden"));
    expect(handleClick).toHaveBeenCalled();
  });
});

// ============================================================================
// WorkCard Tests
// ============================================================================

describe("components/Cards/WorkCard", () => {
  const mockWorkItem = {
    id: "work-1",
    type: "work" as const,
    title: "Tree Planting",
    description: "Planted 5 oak trees in the north section",
    gardenId: "0xGarden123",
    gardenName: "Community Garden",
    status: "pending" as const,
    createdAt: Date.now() - 3600000,
    retryCount: 0,
    size: 1024000,
    images: {
      count: 3,
      totalSize: 512000,
    },
  };

  describe("compact layout", () => {
    it("renders work title", () => {
      render(createElement(Wrapper, null, createElement(WorkCard, { work: mockWorkItem })));

      expect(screen.getByText("Tree Planting")).toBeInTheDocument();
    });

    it("renders status in badge", () => {
      render(createElement(Wrapper, null, createElement(WorkCard, { work: mockWorkItem })));

      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("shows image count in badge", () => {
      render(createElement(Wrapper, null, createElement(WorkCard, { work: mockWorkItem })));

      // Image count of 3 is shown in the badge
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("shows approved status", () => {
      const approvedWork = { ...mockWorkItem, status: "approved" as const };
      render(createElement(Wrapper, null, createElement(WorkCard, { work: approvedWork })));

      expect(screen.getByText("Approved")).toBeInTheDocument();
    });

    it("shows rejected status", () => {
      const rejectedWork = { ...mockWorkItem, status: "rejected" as const };
      render(createElement(Wrapper, null, createElement(WorkCard, { work: rejectedWork })));

      expect(screen.getByText("Rejected")).toBeInTheDocument();
    });

    it("shows syncing status", () => {
      const syncingWork = { ...mockWorkItem, status: "syncing" as const };
      render(createElement(Wrapper, null, createElement(WorkCard, { work: syncingWork })));

      expect(screen.getByText("Syncing")).toBeInTheDocument();
    });

    it("shows error badge when error present", () => {
      const errorWork = { ...mockWorkItem, status: "failed" as const, error: "Network timeout" };
      render(createElement(Wrapper, null, createElement(WorkCard, { work: errorWork })));

      expect(screen.getByText("Error")).toBeInTheDocument();
    });

    it("shows retry count in badge when retries occurred", () => {
      const retriedWork = {
        ...mockWorkItem,
        retryCount: 2,
        lastAttempt: Date.now() - 60000,
      };
      render(createElement(Wrapper, null, createElement(WorkCard, { work: retriedWork })));

      // Retry count of 2 is shown in badge
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("handles click", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(
          Wrapper,
          null,
          createElement(WorkCard, { work: mockWorkItem, onClick: handleClick })
        )
      );

      await user.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// MinimalWorkCard Tests
// ============================================================================

describe("components/Cards/MinimalWorkCard", () => {
  const mockWork = {
    id: "work-1",
    title: "Plant Flowers",
    gardenAddress: "0xGarden123",
    gardenerAddress: "0xGardener456",
    media: ["https://example.com/photo.jpg"],
    feedback: "Great work on the roses!",
    status: "approved",
    createdAt: Date.now() - 7200000,
  } as any;

  it("renders action title", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(MinimalWorkCard, { work: mockWork, onClick: vi.fn() })
      )
    );

    expect(screen.getByText("Plant Flowers")).toBeInTheDocument();
  });

  it("uses custom action title when provided", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(MinimalWorkCard, {
          work: mockWork,
          onClick: vi.fn(),
          actionTitle: "Custom Title",
        })
      )
    );

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
  });

  it("shows feedback badge when work has feedback", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(MinimalWorkCard, { work: mockWork, onClick: vi.fn() })
      )
    );

    expect(screen.getByText("Feedback")).toBeInTheDocument();
  });

  it("shows media count badge", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(MinimalWorkCard, { work: mockWork, onClick: vi.fn() })
      )
    );

    // Should show "1" for 1 media item
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(
        Wrapper,
        null,
        createElement(MinimalWorkCard, { work: mockWork, onClick: handleClick })
      )
    );

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalled();
  });

  it("shows relative time", () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(MinimalWorkCard, { work: mockWork, onClick: vi.fn() })
      )
    );

    expect(screen.getByText(/2 hours ago/)).toBeInTheDocument();
  });
});
