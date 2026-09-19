/**
 * Review uploads in the sync bar opens Your Work at the person's submissions,
 * going Home first from any other tab, because Your Work opens from Home.
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openWorkDashboard = vi.fn();

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));
vi.mock("@green-goods/shared/components/SyncStatusBar", () => ({
  SyncStatusBar: ({ onReviewUploads }: { onReviewUploads?: () => void }) =>
    createElement("button", { type: "button", onClick: onReviewUploads }, "Review uploads"),
}));
vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => ({ isInstalled: true, isPwaPresentation: true }),
}));
vi.mock("@green-goods/shared/hooks/work/usePendingWorksCount", () => ({
  usePendingWorksCount: () => ({ data: 1 }),
}));
vi.mock("@green-goods/shared/stores/useUIStore", () => ({
  useUIStore: (selector: (store: unknown) => unknown) =>
    selector({ openSheetCount: 0, openWorkDashboard }),
}));

import { AppBar } from "../../components/Layout/AppBar";

function Location() {
  return createElement("output", { "data-testid": "location" }, useLocation().pathname);
}

function renderAt(path: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        IntlProvider,
        {
          locale: "en",
          messages: { "app.home": "Home", "app.garden": "Garden", "app.profile": "Profile" },
        },
        createElement(AppBar),
        createElement(
          Routes,
          null,
          createElement(Route, { path: "*", element: createElement(Location) })
        )
      )
    )
  );
}

beforeEach(() => {
  openWorkDashboard.mockClear();
});

describe("AppBar Review uploads", () => {
  it("goes Home and opens Your Work at the person's submissions from another tab", () => {
    renderAt("/home/profile");

    fireEvent.click(screen.getByRole("button", { name: "Review uploads" }));

    expect(openWorkDashboard).toHaveBeenCalledWith("pending", "mySubmissions");
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/home$/);
  });

  it("opens Your Work in place when already Home", () => {
    renderAt("/home/");

    fireEvent.click(screen.getByRole("button", { name: "Review uploads" }));

    expect(openWorkDashboard).toHaveBeenCalledWith("pending", "mySubmissions");
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/home\/$/);
  });
});
