/**
 * Root Tests
 * @vitest-environment happy-dom
 *
 * Root mounts the toast viewport beside the routed canvas, outside the canvas's
 * `[data-tone]`. The viewport carries the route's workspace tone itself, so a
 * toast's action draws the cockpit's focus ring rather than the generic blue.
 */

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

vi.mock("@green-goods/shared/hooks/analytics/useAnalyticsIdentity", () => ({
  useAnalyticsIdentity: () => undefined,
}));
vi.mock("@green-goods/shared/hooks/analytics/usePageView", () => ({
  usePageView: () => undefined,
}));
vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => ({ locale: "en" }),
}));
vi.mock("@green-goods/shared/components/Toast/ToastViewport", () => ({
  ToastViewport: () => <div data-testid="toast-viewport" />,
}));

import Root from "@/routes/Root";

function renderAt(path: string) {
  renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Root />}>
          <Route path="*" element={<p>Routed view</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("Root", () => {
  it.each([
    ["/", "home"],
    ["/hub/work", "hub"],
    ["/garden/0x1234567890123456789012345678901234567890/work", "garden"],
    ["/community", "community"],
  ])("gives the toasts on %s the %s workspace's tone", (path, tone) => {
    renderAt(path);

    expect(screen.getByText("Routed view")).toBeInTheDocument();
    expect(screen.getByTestId("toast-viewport").closest("[data-tone]")).toHaveAttribute(
      "data-tone",
      tone
    );
  });
});
