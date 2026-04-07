/**
 * PlatformRouter Tests
 *
 * Verifies root path (/) routing based on display mode:
 * - Browser mode: redirects to /gardens (public gallery)
 * - Standalone PWA mode: redirects to /home (auth'd dashboard)
 * - No redirect loops on /gardens or /home
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockUseApp = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useApp: () => mockUseApp(),
}));

import PlatformRouter from "../../routes/PlatformRouter";

const GardensPage = () => createElement("div", { "data-testid": "gardens-page" }, "Gardens Page");
const HomePage = () => createElement("div", { "data-testid": "home-page" }, "Home Page");

function renderAtRoute(initialRoute = "/") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/",
          element: createElement(PlatformRouter),
        }),
        createElement(Route, {
          path: "/gardens",
          element: createElement(GardensPage),
        }),
        createElement(Route, {
          path: "/home",
          element: createElement(HomePage),
        })
      )
    )
  );
}

describe("PlatformRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("browser mode: / redirects to /gardens (public gallery)", () => {
    mockUseApp.mockReturnValue({ isInstalled: false });

    renderAtRoute("/");

    expect(screen.getByTestId("gardens-page")).toBeInTheDocument();
    expect(screen.queryByTestId("home-page")).not.toBeInTheDocument();
  });

  it("standalone PWA mode: / redirects to /home (auth'd dashboard)", () => {
    mockUseApp.mockReturnValue({ isInstalled: true });

    renderAtRoute("/");

    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.queryByTestId("gardens-page")).not.toBeInTheDocument();
  });

  it("/gardens and /home are accessible without redirect loops", () => {
    // Verify that navigating directly to /gardens or /home works
    // (PlatformRouter only handles /, not these paths)
    mockUseApp.mockReturnValue({ isInstalled: false });

    const { unmount } = render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/gardens"] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/",
            element: createElement(PlatformRouter),
          }),
          createElement(Route, {
            path: "/gardens",
            element: createElement(GardensPage),
          }),
          createElement(Route, {
            path: "/home",
            element: createElement(HomePage),
          })
        )
      )
    );

    expect(screen.getByTestId("gardens-page")).toBeInTheDocument();
    unmount();

    // Also check /home direct access
    mockUseApp.mockReturnValue({ isInstalled: true });

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home"] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/",
            element: createElement(PlatformRouter),
          }),
          createElement(Route, {
            path: "/gardens",
            element: createElement(GardensPage),
          }),
          createElement(Route, {
            path: "/home",
            element: createElement(HomePage),
          })
        )
      )
    );

    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });
});
