/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isOnline: true, pendingCount: 2, bannerVisible: true }));

vi.mock("../../hooks/app/useOffline", () => ({
  useOffline: () => ({ isOnline: state.isOnline }),
}));
vi.mock("../../hooks/work/usePendingWorksCount", () => ({
  usePendingWorksCount: () => ({ data: state.pendingCount }),
}));
vi.mock("../../stores/useUIStore", () => ({
  useUIStore: (selector: (store: { isOfflineBannerVisible: boolean }) => unknown) =>
    selector({ isOfflineBannerVisible: state.bannerVisible }),
}));

import { SyncStatusBar } from "../../components/SyncStatusBar";
import en from "../../i18n/en.json";

function renderBar(onReviewUploads?: () => void) {
  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages: en },
      createElement(SyncStatusBar, { onReviewUploads })
    )
  );
}

beforeEach(() => {
  state.isOnline = true;
  state.pendingCount = 2;
  state.bannerVisible = true;
});

describe("SyncStatusBar", () => {
  it("says how much waits to upload and opens Your Work for everyone", () => {
    const onReviewUploads = vi.fn();
    renderBar(onReviewUploads);

    expect(screen.getByRole("status")).toHaveTextContent("2 items waiting to upload");
    fireEvent.click(screen.getByRole("button", { name: "Review uploads" }));
    expect(onReviewUploads).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
  });

  it("says the work is saved on this device while offline, and never promises to send it", () => {
    state.isOnline = false;
    state.pendingCount = 1;
    renderBar(vi.fn());

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Offline: 1 item saved on this device");
    expect(status).not.toHaveTextContent(/when you're back online/i);
    expect(screen.getByRole("button", { name: "Review uploads" })).toBeEnabled();
  });

  it("shows no action without a way to open Your Work", () => {
    renderBar();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["nothing is queued", { pendingCount: 0 }],
    ["the banner is hidden", { bannerVisible: false }],
  ])("renders nothing when %s", (_label, overrides) => {
    Object.assign(state, overrides);
    const { container } = renderBar(vi.fn());
    expect(container).toBeEmptyDOMElement();
  });
});
