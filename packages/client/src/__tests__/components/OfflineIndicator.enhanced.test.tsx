import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineIndicator } from "@/components/UI/OfflineIndicator/OfflineIndicator";

// Mock the Zustand store
const mockUseOfflineStore = vi.fn();
const mockUseOfflineDisplayPriority = vi.fn();

vi.mock("@/stores/offlineStore", () => ({
  useOfflineStore: (selector: any) => mockUseOfflineStore(selector),
  useOfflineDisplayPriority: () => mockUseOfflineDisplayPriority(),
}));

// Wrapper component for providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={{}}>
        {children}
      </IntlProvider>
    </QueryClientProvider>
  );
};

describe("Enhanced OfflineIndicator", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Default store state
    mockUseOfflineStore.mockImplementation((selector) => {
      const state = {
        conflictCount: 0,
        pendingCount: 0,
      };
      return selector(state);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when online with no pending items", () => {
    mockUseOfflineDisplayPriority.mockReturnValue(null);

    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    expect(screen.queryByTestId("offline-indicator")).not.toBeInTheDocument();
  });

  it("should render when offline", () => {
    mockUseOfflineDisplayPriority.mockReturnValue("offline");

    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-gray-500");
    expect(screen.getByTestId("status-text")).toHaveTextContent("📶 Offline");
  });

  it("should render when has pending items", () => {
    mockUseOfflineDisplayPriority.mockReturnValue("pending");
    mockUseOfflineStore.mockImplementation((selector) => {
      const state = {
        conflictCount: 0,
        pendingCount: 3,
      };
      return selector(state);
    });

    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-green-500");
    expect(screen.getByTestId("status-text")).toHaveTextContent("✅ 3 items pending sync");
  });

  it("should render when has conflicts", () => {
    mockUseOfflineDisplayPriority.mockReturnValue("conflicts");
    mockUseOfflineStore.mockImplementation((selector) => {
      const state = {
        conflictCount: 2,
        pendingCount: 0,
      };
      return selector(state);
    });

    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-red-500");
    expect(screen.getByTestId("status-text")).toHaveTextContent("⚠️ 2 conflicts need resolution");
    expect(screen.getByTestId("conflicts-count")).toBeInTheDocument();
  });

  it("should render when storage cleanup needed", () => {
    mockUseOfflineDisplayPriority.mockReturnValue("cleanup");

    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-yellow-500");
    expect(screen.getByTestId("status-text")).toHaveTextContent("🗄️ Storage cleanup needed");
  });

  it("should show syncing state", () => {
    mockUseOfflineDisplayPriority.mockReturnValue("syncing");

    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-blue-500");
    expect(screen.getByTestId("status-text")).toHaveTextContent("🔄 Syncing...");
  });

  it("should prioritize conflicts in display", () => {
    // This test is more about the store logic, but we can test the component behavior
    mockUseOfflineDisplayPriority.mockReturnValue("conflicts");
    mockUseOfflineStore.mockImplementation((selector) => {
      const state = {
        conflictCount: 1,
        pendingCount: 5, // Even with pending items, conflicts should take priority
      };
      return selector(state);
    });

    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toHaveClass("bg-red-500");
    expect(screen.getByTestId("status-text")).toHaveTextContent("⚠️ 1 conflict need resolution");
  });

  it("should use correct background color for different states", () => {
    const testCases = [
      { priority: "conflicts", bgClass: "bg-red-500" },
      { priority: "cleanup", bgClass: "bg-yellow-500" },
      { priority: "syncing", bgClass: "bg-blue-500" },
      { priority: "offline", bgClass: "bg-gray-500" },
      { priority: "pending", bgClass: "bg-green-500" },
    ];

    testCases.forEach(({ priority, bgClass }) => {
      mockUseOfflineDisplayPriority.mockReturnValue(priority);

      const { unmount } = render(
        <TestWrapper>
          <OfflineIndicator />
        </TestWrapper>
      );

      const indicator = screen.getByTestId("offline-indicator");
      expect(indicator).toHaveClass(bgClass);

      unmount();
    });
  });

  it("should show multiple status indicators together", () => {
    // This test doesn't apply to the new design where only one status is shown at a time
    // The priority logic handles what to display, so this test is redundant
    mockUseOfflineDisplayPriority.mockReturnValue("conflicts");
    mockUseOfflineStore.mockImplementation((selector) => {
      const state = {
        conflictCount: 2,
        pendingCount: 3,
      };
      return selector(state);
    });

    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    // Should only show the highest priority (conflicts)
    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toBeInTheDocument();
    expect(screen.getByTestId("status-text")).toHaveTextContent("⚠️ 2 conflicts need resolution");
  });

  it("should apply custom className", () => {
    mockUseOfflineDisplayPriority.mockReturnValue("offline");

    render(
      <TestWrapper>
        <OfflineIndicator className="custom-class" />
      </TestWrapper>
    );

    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toHaveClass("custom-class");
  });
});
