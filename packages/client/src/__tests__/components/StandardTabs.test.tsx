/**
 * StandardTabs Component Tests
 *
 * Tests the reusable tab navigation component: tab rendering, active state,
 * tab switching, disabled tabs, count badges, and loading indicator.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { StandardTabs } from "../../components/Navigation/Tabs/StandardTabs";

const baseTabs = [
  { id: "tab1", label: "First Tab" },
  { id: "tab2", label: "Second Tab" },
  { id: "tab3", label: "Third Tab" },
];

describe("StandardTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all tabs", () => {
    render(
      createElement(StandardTabs, {
        tabs: baseTabs,
        activeTab: "tab1",
        onTabChange: vi.fn(),
      })
    );

    expect(screen.getByTestId("tab-tab1")).toBeInTheDocument();
    expect(screen.getByTestId("tab-tab2")).toBeInTheDocument();
    expect(screen.getByTestId("tab-tab3")).toBeInTheDocument();
    expect(screen.getByText("First Tab")).toBeInTheDocument();
    expect(screen.getByText("Second Tab")).toBeInTheDocument();
  });

  it("calls onTabChange when a tab is clicked", async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(StandardTabs, {
        tabs: baseTabs,
        activeTab: "tab1",
        onTabChange,
      })
    );

    await user.click(screen.getByTestId("tab-tab2"));
    expect(onTabChange).toHaveBeenCalledWith("tab2");
  });

  it("does not call onTabChange for disabled tabs", async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    const tabsWithDisabled = [
      { id: "tab1", label: "Active" },
      { id: "tab2", label: "Disabled", disabled: true },
    ];

    render(
      createElement(StandardTabs, {
        tabs: tabsWithDisabled,
        activeTab: "tab1",
        onTabChange,
      })
    );

    await user.click(screen.getByTestId("tab-tab2"));
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("renders count badges when count is provided", () => {
    const tabsWithCounts = [
      { id: "tab1", label: "Messages", count: 5 },
      { id: "tab2", label: "Notifications", count: 0 },
      { id: "tab3", label: "Overflow", count: 150 },
    ];

    render(
      createElement(StandardTabs, {
        tabs: tabsWithCounts,
        activeTab: "tab1",
        onTabChange: vi.fn(),
      })
    );

    // Count 5 should show
    expect(screen.getByText("5")).toBeInTheDocument();
    // Count 0 should not show (filtered by > 0)
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    // Count > 99 shows 99+
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("renders tab icons", () => {
    const tabsWithIcons = [
      { id: "tab1", label: "Home", icon: createElement("span", { "data-testid": "icon-home" }) },
      { id: "tab2", label: "Settings", icon: "⚙️" },
    ];

    render(
      createElement(StandardTabs, {
        tabs: tabsWithIcons,
        activeTab: "tab1",
        onTabChange: vi.fn(),
      })
    );

    expect(screen.getByTestId("icon-home")).toBeInTheDocument();
    expect(screen.getByText("⚙️")).toBeInTheDocument();
  });

  it("applies active styling to current tab", () => {
    render(
      createElement(StandardTabs, {
        tabs: baseTabs,
        activeTab: "tab2",
        onTabChange: vi.fn(),
      })
    );

    const activeTab = screen.getByTestId("tab-tab2");
    // Active tab has primary text color in className
    expect(activeTab.className).toContain("text-primary");

    const inactiveTab = screen.getByTestId("tab-tab1");
    expect(inactiveTab.className).toContain("text-text-sub-600");
  });

  it("renders with compact variant", () => {
    render(
      createElement(StandardTabs, {
        tabs: baseTabs,
        activeTab: "tab1",
        onTabChange: vi.fn(),
        variant: "compact",
      })
    );

    // Compact variant uses py-2.5 instead of py-3
    const tab = screen.getByTestId("tab-tab1");
    expect(tab.className).toContain("py-2.5");
  });

  it("disabled tab has disabled attribute", () => {
    const tabsWithDisabled = [
      { id: "tab1", label: "Active" },
      { id: "tab2", label: "Disabled", disabled: true },
    ];

    render(
      createElement(StandardTabs, {
        tabs: tabsWithDisabled,
        activeTab: "tab1",
        onTabChange: vi.fn(),
      })
    );

    expect(screen.getByTestId("tab-tab2")).toBeDisabled();
  });
});
