/**
 * UploadingTab Component Tests
 *
 * Tests the uploading/recent work tab: loading, error, empty,
 * online sync, and offline reconnect states.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track mock state
const mockUserState = { authMode: "passkey" as "passkey" | "wallet" };
const mockOfflineState = { isOnline: true };

// Mock @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  hapticLight: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  trackSyncError: vi.fn(),
  useBatchWorkSync: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useOffline: () => mockOfflineState,
  useQueueFlush: () => vi.fn().mockResolvedValue(undefined),
  useTimeout: () => ({ set: vi.fn(), clear: vi.fn(), isPending: false }),
  useUser: () => mockUserState,
}));

// Mock @remixicon/react
vi.mock("@remixicon/react", () => ({
  RiTimeLine: (props: any) => createElement("span", { ...props }),
}));

// Mock client components
vi.mock("@/components/Cards", () => ({
  MinimalWorkCard: ({
    work,
    onClick,
    badges,
    confirmed,
  }: {
    work: { id: string; title?: string };
    onClick: () => void;
    badges?: React.ReactNode[];
    confirmed?: boolean;
  }) =>
    createElement(
      "div",
      {
        "data-testid": `work-card-${work.id}`,
        onClick,
        "data-confirmed": confirmed ? "true" : undefined,
      },
      createElement("span", null, work.title || work.id),
      badges && createElement("div", { "data-testid": "badges" }, ...badges)
    ),
}));

vi.mock("@/components/Communication", () => ({
  Loader: () => createElement("div", { "data-testid": "loader" }, "Loading..."),
}));

import { UploadingTab } from "../../views/Home/WorkDashboard/Uploading";

const wrap = (el: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages: {} }, el);

const mockWork = (id: string, title?: string) => ({
  id,
  title: title || `Work ${id}`,
  actionUID: 1,
  gardenerAddress: "0x1234",
  gardenAddress: "0x5678",
  feedback: "",
  metadata: "",
  media: [],
  createdAt: Date.now(),
  status: "pending" as const,
});

describe("UploadingTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOfflineState.isOnline = true;
    mockUserState.authMode = "passkey";
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading state", () => {
    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: [],
          isLoading: true,
          onWorkClick: vi.fn(),
        })
      )
    );

    expect(screen.getByTestId("loader")).toBeInTheDocument();
    expect(screen.getByText(/loading recent work/i)).toBeInTheDocument();
  });

  it("shows error state with retry", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();

    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: [],
          isLoading: false,
          hasError: true,
          onWorkClick: vi.fn(),
          onRefresh,
        })
      )
    );

    expect(screen.getByText(/unable to load work/i)).toBeInTheDocument();
    await user.click(screen.getByText("Retry"));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("shows empty state when no work", () => {
    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: [],
          isLoading: false,
          onWorkClick: vi.fn(),
        })
      )
    );

    expect(screen.getByText(/no recent work/i)).toBeInTheDocument();
    expect(screen.getByText(/work you submit will appear here/i)).toBeInTheDocument();
  });

  it("renders work cards for online work", () => {
    const works = [mockWork("w1", "Online Work")];

    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: works,
          isLoading: false,
          onWorkClick: vi.fn(),
        })
      )
    );

    expect(screen.getByTestId("work-card-w1")).toBeInTheDocument();
    expect(screen.getByText(/1 recent items/i)).toBeInTheDocument();
  });

  it("shows uploading badge for offline work", () => {
    const works = [mockWork("0xoffline_123", "Offline Work")];

    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: works,
          isLoading: false,
          onWorkClick: vi.fn(),
        })
      )
    );

    expect(screen.getByText("Uploading")).toBeInTheDocument();
  });

  it("shows sync button when online with offline work", () => {
    mockOfflineState.isOnline = true;
    const works = [mockWork("0xoffline_123")];

    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: works,
          isLoading: false,
          onWorkClick: vi.fn(),
        })
      )
    );

    expect(screen.getByText("Sync All")).toBeInTheDocument();
  });

  it("shows reconnect message when offline with offline work", () => {
    mockOfflineState.isOnline = false;
    const works = [mockWork("0xoffline_123")];

    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: works,
          isLoading: false,
          onWorkClick: vi.fn(),
        })
      )
    );

    expect(screen.getByText(/reconnect to sync/i)).toBeInTheDocument();
  });

  it("does not show sync button for online-only work", () => {
    const works = [mockWork("w1", "Regular Work")];

    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: works,
          isLoading: false,
          onWorkClick: vi.fn(),
        })
      )
    );

    expect(screen.queryByText("Sync All")).not.toBeInTheDocument();
    expect(screen.queryByText(/reconnect/i)).not.toBeInTheDocument();
  });

  it("calls onWorkClick when card is clicked", async () => {
    const onWorkClick = vi.fn();
    const user = userEvent.setup();
    const works = [mockWork("w1")];

    render(
      wrap(
        createElement(UploadingTab, {
          uploadingWork: works,
          isLoading: false,
          onWorkClick,
        })
      )
    );

    await user.click(screen.getByTestId("work-card-w1"));
    expect(onWorkClick).toHaveBeenCalledWith(works[0]);
  });
});
