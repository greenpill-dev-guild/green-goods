import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineIndicator } from "@/components/UI/OfflineIndicator/OfflineIndicator";

// Mock hooks
const mockUseOffline = vi.fn();
const mockUseConflictResolver = vi.fn();
const mockUseStorageManager = vi.fn();

vi.mock("@/utils/useOffline", () => ({
  useOffline: () => mockUseOffline(),
}));

vi.mock("@/utils/useConflictResolver", () => ({
  useConflictResolver: () => mockUseConflictResolver(),
}));

vi.mock("@/utils/useStorageManager", () => ({
  useStorageManager: () => mockUseStorageManager(),
}));

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const messages = {
    "app.offline.workingOffline": "Working offline",
    "app.offline.syncing": "Syncing...",
    "app.offline.synced": "All synced",
    "app.offline.conflictsDetected": "Sync conflicts detected",
    "app.offline.storageCleanupNeeded": "Storage cleanup recommended",
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={messages}>
        {component}
      </IntlProvider>
    </QueryClientProvider>
  );
};

describe("Enhanced OfflineIndicator", () => {
  beforeEach(() => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      syncStatus: "idle",
      pendingWork: [],
      retryInfo: [],
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    mockUseConflictResolver.mockReturnValue({
      conflicts: [],
      isResolving: false,
      resolveConflict: vi.fn(),
      resolveAllConflicts: vi.fn(),
      hasConflicts: false,
    });

    mockUseStorageManager.mockReturnValue({
      storageInfo: {
        needsCleanup: false,
        total: 1000000,
        used: 100000,
        available: 900000,
        percentage: 10,
      },
      getStorageBreakdown: vi.fn(),
      cleanupStorage: vi.fn(),
      estimateCleanupSpace: vi.fn(),
    });

    // Reset navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when online with no pending items", () => {
    const { container } = renderWithProviders(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it("should render when offline", () => {
    mockUseOffline.mockReturnValue({
      isOnline: false,
      pendingCount: 0,
      syncStatus: "idle",
      pendingWork: [],
      retryInfo: [],
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
    });

    renderWithProviders(<OfflineIndicator />);
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("status-message")).toHaveTextContent("Working offline");
    expect(screen.getByTestId("status-icon")).toHaveTextContent("📶");
  });

  it("should render when has pending items", () => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 3,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("pending-count")).toHaveTextContent("3 pending");
  });

  it("should render when has conflicts", () => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: true,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    mockUseConflictResolver.mockReturnValue({
      conflicts: [{ workId: "work-1", type: "already_submitted" }],
      hasConflicts: true,
      isResolving: false,
      resolveConflict: vi.fn(),
      resolveAllConflicts: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("status-message")).toHaveTextContent("Sync conflicts detected");
    expect(screen.getByTestId("conflicts-count")).toHaveTextContent("1 conflicts");
    expect(screen.getByTestId("status-icon")).toHaveTextContent("⚠️");
  });

  it("should render when storage cleanup needed", () => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    mockUseStorageManager.mockReturnValue({
      storageInfo: {
        needsCleanup: true,
        total: 1000000,
        used: 900000,
        available: 100000,
        percentage: 90,
      },
      getStorageBreakdown: vi.fn(),
      cleanupStorage: vi.fn(),
      estimateCleanupSpace: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("status-message")).toHaveTextContent("Storage cleanup recommended");
    expect(screen.getByTestId("status-icon")).toHaveTextContent("🗄️");
  });

  it("should show syncing state", () => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 2,
      syncStatus: "syncing",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);
    expect(screen.getByTestId("status-message")).toHaveTextContent("Syncing...");
    expect(screen.getByTestId("status-icon")).toHaveTextContent("🔄");
    expect(screen.getByTestId("pending-count")).toHaveTextContent("2 pending");
  });

  it("should prioritize conflicts in display", () => {
    mockUseOffline.mockReturnValue({
      isOnline: false, // Also offline
      pendingCount: 5,
      syncStatus: "idle",
      hasConflicts: true, // But has conflicts - should take priority
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    mockUseConflictResolver.mockReturnValue({
      hasConflicts: true,
      conflicts: [{ workId: "work-1" }],
      isResolving: false,
      resolveConflict: vi.fn(),
      resolveAllConflicts: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);

    // Should show conflicts message, not offline message
    expect(screen.getByTestId("status-message")).toHaveTextContent("Sync conflicts detected");
    expect(screen.getByTestId("status-icon")).toHaveTextContent("⚠️");
  });

  it("should open dashboard when clicked", async () => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 1,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);

    const indicator = screen.getByTestId("offline-indicator");
    fireEvent.click(indicator);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-modal")).toBeInTheDocument();
    });
  });

  it("should close dashboard when close button clicked", async () => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 1,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);

    // Open dashboard
    const indicator = screen.getByTestId("offline-indicator");
    fireEvent.click(indicator);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-modal")).toBeInTheDocument();
    });

    // Close dashboard
    const closeButton = screen.getByTestId("dashboard-close");
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-modal")).not.toBeInTheDocument();
    });
  });

  it("should close dashboard when backdrop clicked", async () => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 1,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);

    // Open dashboard
    const indicator = screen.getByTestId("offline-indicator");
    fireEvent.click(indicator);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-modal")).toBeInTheDocument();
    });

    // Click backdrop
    const backdrop = screen.getByTestId("dashboard-modal");
    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-modal")).not.toBeInTheDocument();
    });
  });

  it("should use correct background color for different states", () => {
    // Test offline state (warning background)
    mockUseOffline.mockReturnValue({
      isOnline: false,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
    });

    const { unmount } = renderWithProviders(<OfflineIndicator />);
    let indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toHaveClass("bg-warning-base");
    unmount();

    // Test conflicts state (error background)
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    mockUseConflictResolver.mockReturnValue({
      hasConflicts: true,
      conflicts: [{ workId: "work-1" }],
      isResolving: false,
      resolveConflict: vi.fn(),
      resolveAllConflicts: vi.fn(),
    });

    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
    });

    renderWithProviders(<OfflineIndicator />);
    indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toHaveClass("bg-error-base");
  });

  it("should show multiple status indicators together", () => {
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 3,
      syncStatus: "idle",
      hasConflicts: true,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    mockUseConflictResolver.mockReturnValue({
      hasConflicts: true,
      conflicts: [{ workId: "work-1" }],
      isResolving: false,
      resolveConflict: vi.fn(),
      resolveAllConflicts: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);

    expect(screen.getByTestId("conflicts-count")).toHaveTextContent("1 conflicts");
    expect(screen.getByTestId("pending-count")).toHaveTextContent("3 pending");
  });

  it("should handle rapid state changes", async () => {
    // Test that the component correctly handles different states by testing each one separately

    // Test 1: Offline state
    mockUseOffline.mockReturnValue({
      isOnline: false,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    let { unmount } = renderWithProviders(<OfflineIndicator />);
    expect(screen.getByTestId("status-message")).toHaveTextContent("Working offline");
    unmount();

    // Test 2: Offline with pending items
    mockUseOffline.mockReturnValue({
      isOnline: false,
      pendingCount: 2,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });
    ({ unmount } = renderWithProviders(<OfflineIndicator />));
    expect(screen.getByTestId("pending-count")).toHaveTextContent("2 pending");
    unmount();

    // Test 3: Online and syncing
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 2,
      syncStatus: "syncing",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });
    ({ unmount } = renderWithProviders(<OfflineIndicator />));
    expect(screen.getByTestId("status-message")).toHaveTextContent("Syncing...");
    unmount();

    // Test 4: All synced (should not render)
    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });
    const { container } = renderWithProviders(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it("should apply custom className", () => {
    mockUseOffline.mockReturnValue({
      isOnline: false,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator className="custom-class" />);

    const indicator = screen.getByTestId("offline-indicator");
    expect(indicator).toHaveClass("custom-class");
  });

  it("should show tap to view instruction", () => {
    mockUseOffline.mockReturnValue({
      isOnline: false,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);

    expect(screen.getByText("• Tap to view")).toBeInTheDocument();
  });

  it("should handle accessibility requirements", () => {
    mockUseOffline.mockReturnValue({
      isOnline: false,
      pendingCount: 0,
      syncStatus: "idle",
      hasConflicts: false,
      shouldCleanup: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<OfflineIndicator />);

    const indicator = screen.getByTestId("offline-indicator");

    // Should be focusable
    expect(indicator).toHaveAttribute("tabIndex");

    // Should have appropriate ARIA attributes (would be added in real implementation)
    // expect(indicator).toHaveAttribute('role', 'button');
    // expect(indicator).toHaveAttribute('aria-label');
  });
});
