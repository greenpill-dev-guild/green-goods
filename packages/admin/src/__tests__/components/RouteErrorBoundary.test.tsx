/**
 * @vitest-environment happy-dom
 *
 * A route that fails shows the state block in the page's space: every kind of
 * failure is announced exactly once, and each keeps its own acts. The chunk
 * self-heal helper keeps its own file (chunkAutoRecovery.test.ts).
 */
// TEST-QUALITY: allow-small-test-file - the rendered route failure is a new subject, and its three kinds are all it has

import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RouteErrorBoundary from "../../components/RouteErrorBoundary";
import { renderWithProviders, screen, userEvent } from "../test-utils";

vi.mock("@green-goods/shared/modules/app/error-events", () => ({
  trackErrorBoundary: vi.fn(),
}));

const reload = vi.fn();

function Crash({ message }: { message: string }): never {
  throw new Error(message);
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderFailingRoute(message: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Outlet />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { path: "hub", element: <Where /> },
          { path: "hub/assess/create", element: <Crash message={message} /> },
        ],
      },
    ],
    { initialEntries: ["/hub", "/hub/assess/create"], initialIndex: 1 }
  );
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe("RouteErrorBoundary", () => {
  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, pathname: "/hub/assess/create", reload },
    });
    // React reports the thrown render error; the route state is what is under test.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("announces a crashed route once and offers Go Back and Reload", async () => {
    const user = userEvent.setup();
    const router = renderFailingRoute("Cannot read properties of undefined");

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "Something went wrong" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Go Back" }));
    expect(router.state.location.pathname).toBe("/hub");
  });

  it("announces a lost connection once, though it is a warning and not a failure", async () => {
    const user = userEvent.setup();
    renderFailingRoute("Failed to fetch");

    const alert = screen.getByRole("alert");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(alert).toHaveTextContent("Connection Issue");

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("shows the updated-app state only once its one self-heal is spent", async () => {
    const user = userEvent.setup();
    // The self-heal already reloaded this path a moment ago.
    sessionStorage.setItem("gg-admin-chunk-reload", `/hub/assess/create|${Date.now()}`);
    renderFailingRoute("Failed to fetch dynamically imported module");

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("App Updated");

    await user.click(screen.getByRole("button", { name: "Refresh Page" }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
