/**
 * WorkViewSection Status Rendering Tests
 *
 * Verifies that WorkViewSection renders correctly for ALL 7 WorkDisplayStatus values,
 * not just the original 3 (approved/rejected/pending). This was the root cause of #405:
 * offline statuses (syncing, uploading, sync_failed, offline) hit unhandled code paths.
 */

import type { WorkDisplayStatus } from "@green-goods/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage?: string }) => defaultMessage ?? "",
  }),
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual("@green-goods/shared");
  return {
    ...actual,
    formatTimeSpent: (mins: number) => `${mins}m`,
  };
});

vi.mock("@/components/Actions", () => ({
  Button: ({ label, onClick }: { label: string; onClick?: () => void }) =>
    createElement("button", { onClick, type: "button" }, label),
}));

vi.mock("@/components/Features/Work", () => ({
  WorkView: ({ title, info }: { title: string; info: string }) =>
    createElement("div", { "data-testid": "work-view" }, [
      createElement("span", { key: "title", "data-testid": "work-title" }, title),
      createElement("span", { key: "info", "data-testid": "work-info" }, info),
    ]),
  WorkViewSkeleton: () => createElement("div", { "data-testid": "skeleton" }),
}));

import { WorkViewSection } from "../../views/Home/Garden/WorkViewSection";

const mockWork = {
  id: "0x123",
  actionUID: 1,
  gardenAddress: "0xabc",
  gardenerAddress: "0xdef",
  status: "pending" as WorkDisplayStatus,
  createdAt: Date.now(),
  media: [],
  feedback: "",
  metadata: "",
  title: "Test Work",
};

const baseProps = {
  work: mockWork as any,
  workMetadata: null,
  viewingMode: "viewer" as const,
  actionTitle: "Test Action",
  onDownloadData: vi.fn(),
  onShare: vi.fn(),
};

describe("WorkViewSection — all WorkDisplayStatus values (#405)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  const ALL_STATUSES: WorkDisplayStatus[] = [
    "approved",
    "rejected",
    "pending",
    "syncing",
    "uploading",
    "sync_failed",
    "offline",
  ];

  it.each(ALL_STATUSES)("renders without crashing for status '%s'", (status) => {
    const { container } = render(
      createElement(WorkViewSection, { ...baseProps, effectiveStatus: status })
    );
    expect(container).toBeTruthy();
    expect(screen.getByTestId("work-view")).toBeInTheDocument();
  });

  it("shows the warm sync_failed title for sync_failed status", () => {
    render(
      createElement(WorkViewSection, {
        ...baseProps,
        effectiveStatus: "sync_failed" as WorkDisplayStatus,
      })
    );
    expect(screen.getByTestId("work-title")).toHaveTextContent("Sending didn't work");
  });

  it("shows 'Saved on your device' title for syncing status", () => {
    render(
      createElement(WorkViewSection, {
        ...baseProps,
        effectiveStatus: "syncing" as WorkDisplayStatus,
      })
    );
    expect(screen.getByTestId("work-title")).toHaveTextContent("Saved on your device");
  });

  it("shows 'Saved on your device' title for offline status", () => {
    render(
      createElement(WorkViewSection, {
        ...baseProps,
        effectiveStatus: "offline" as WorkDisplayStatus,
      })
    );
    expect(screen.getByTestId("work-title")).toHaveTextContent("Saved on your device");
  });

  it("shows the warm sending info for syncing/uploading statuses", () => {
    render(
      createElement(WorkViewSection, {
        ...baseProps,
        effectiveStatus: "uploading" as WorkDisplayStatus,
      })
    );
    expect(screen.getByTestId("work-info")).toHaveTextContent("Sending to the garden record...");
  });

  it("shows the offline-saved info for offline status", () => {
    render(
      createElement(WorkViewSection, {
        ...baseProps,
        effectiveStatus: "offline" as WorkDisplayStatus,
      })
    );
    expect(screen.getByTestId("work-info")).toHaveTextContent(
      "Saved on your device — we'll send it to the garden record when you're online."
    );
  });

  it("shows the retry info for sync_failed status", () => {
    render(
      createElement(WorkViewSection, {
        ...baseProps,
        effectiveStatus: "sync_failed" as WorkDisplayStatus,
      })
    );
    expect(screen.getByTestId("work-info")).toHaveTextContent(
      "We couldn't send this just now. We'll keep trying when you're online."
    );
  });

  it("shows operator-specific title for approved status", () => {
    render(
      createElement(WorkViewSection, {
        ...baseProps,
        viewingMode: "operator",
        effectiveStatus: "approved" as WorkDisplayStatus,
      })
    );
    expect(screen.getByTestId("work-title")).toHaveTextContent("Work Approved");
  });

  it("shows gardener-specific info for pending status", () => {
    render(
      createElement(WorkViewSection, {
        ...baseProps,
        viewingMode: "gardener",
        effectiveStatus: "pending" as WorkDisplayStatus,
      })
    );
    expect(screen.getByTestId("work-info")).toHaveTextContent("Submitted for review");
  });
});
