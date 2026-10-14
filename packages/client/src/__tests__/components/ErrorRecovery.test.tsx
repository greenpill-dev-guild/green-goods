// jsdom pin (happy-dom A/B): spies on Storage.prototype.setItem; happy-dom's sessionStorage does not call the spied prototype method.
/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render as renderBare, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/modules/app/error-events", () => ({
  trackErrorBoundary: vi.fn(),
}));

vi.mock("@green-goods/shared/modules/app/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@green-goods/shared/hooks/analytics/usePageView", () => ({
  usePageView: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/ToastViewport", () => ({
  ToastViewport: () => null,
}));

// The two entries are rendered whole below, with everything inside their boundary standing in.
vi.mock("@green-goods/shared/providers/App", () => ({
  AppProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@green-goods/shared/hooks/app/useServiceWorkerUpdate", () => ({
  ServiceWorkerUpdateProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@green-goods/shared/hooks/app/useWorkUpdateGuard", () => ({
  useWorkUpdateGuard: () => false,
  isWorkUpdateBlocked: () => false,
}));
vi.mock("@/webmcp", () => ({ registerPublicWebMcpTools: vi.fn() }));
vi.mock("@/PublicApp", () => ({
  PublicApp: () => {
    throw new Error("The site failed to start");
  },
}));
vi.mock("@/PwaApp", () => ({
  PwaApp: () => {
    throw new Error("The app failed to start");
  },
}));

import { trackErrorBoundary } from "@green-goods/shared/modules/app/error-events";
import { AppErrorBoundary } from "../../components/Errors/AppErrorBoundary";
import { AppRecoveryViews } from "../../components/Errors/AppRecoveryViews";
import { ErrorRecovery } from "../../components/Errors/ErrorRecovery";
import {
  hasChunkReloadAttempt,
  markChunkReloadAttempt,
} from "../../components/Errors/errorClassification";
import { PublicRecoveryViews } from "../../components/Errors/PublicRecoveryViews";
import { recoveryLanguage } from "../../components/Errors/recoveryCopy";
import Root from "../../routes/Root";
import { renderWithProviders } from "../test-utils";

/** What a lazy screen throws when its code is gone: a new build, or no connection. */
const MISSING_CODE = new TypeError(
  "Failed to fetch dynamically imported module: https://localhost:3001/src/routes/AppShell.tsx"
);

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: online });
}

function comeBackOnline() {
  setOnline(true);
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
}

/** The installed app's frame failing, which needs no router and no provider around it. */
function appFailure(error: unknown) {
  return (
    <AppRecoveryViews>
      <ErrorRecovery error={error} view="frame" boundary="RouteErrorBoundary" />
    </AppRecoveryViews>
  );
}

const recover = (error: unknown) => renderBare(appFailure(error));

function blockStorageWrites() {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Session storage denied", "SecurityError");
  });
}

function ThrowWhileRendering(): never {
  throw new Error("Render failed");
}

const reloadButton = () => screen.getByRole("button", { name: "Reload" });

beforeEach(() => {
  // React logs every error a boundary catches.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  setOnline(true);
  window.__GG_MARK_BOOT_FAILED = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  setOnline(true);
  delete window.__GG_MARK_BOOT_FAILED;
});

describe("error recovery", () => {
  it("reloads once onto a new build, without an error screen or a report", () => {
    recover(MISSING_CODE);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(hasChunkReloadAttempt()).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Updating Green Goods…");
    expect(trackErrorBoundary).not.toHaveBeenCalled();
    // The static loading screen is not dismissed for a reload: nothing flashes in between.
    expect(window.__GG_MARK_BOOT_FAILED).not.toHaveBeenCalled();
  });

  it("stops after that reload when the code is still missing, and reports it", () => {
    markChunkReloadAttempt();
    recover(MISSING_CODE);

    expect(window.location.reload).not.toHaveBeenCalled();
    expect(screen.getByRole("heading")).toHaveTextContent("Green Goods couldn't open.");
    expect(trackErrorBoundary).toHaveBeenCalledWith(
      MISSING_CODE,
      expect.objectContaining({ boundaryName: "RouteErrorBoundary:chunk" })
    );

    fireEvent.click(reloadButton());
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("says it is offline, waits, and reloads once when the connection returns", () => {
    setOnline(false);
    recover(MISSING_CODE);

    expect(screen.getByRole("heading")).toHaveTextContent("You're offline.");
    expect(trackErrorBoundary).toHaveBeenCalledWith(
      MISSING_CODE,
      expect.objectContaining({ boundaryName: "RouteErrorBoundary:offline", isOffline: true })
    );
    // The code cannot arrive without a connection, so Reload waits with the screen.
    fireEvent.click(reloadButton());
    expect(window.location.reload).not.toHaveBeenCalled();

    comeBackOnline();
    comeBackOnline();

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    // The reloaded page finds the mark and does not reload itself a second time.
    expect(hasChunkReloadAttempt()).toBe(true);
  });

  it("keeps its promise to load on reconnect after this tab used its automatic reload", () => {
    markChunkReloadAttempt();
    setOnline(false);
    recover(MISSING_CODE);
    expect(screen.getByRole("heading")).toHaveTextContent("You're offline.");

    comeBackOnline();

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("stops listening for the connection once the screen is gone", () => {
    setOnline(false);
    const { unmount } = recover(MISSING_CODE);
    unmount();

    comeBackOnline();

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("reports and leaves Reload working when the reload mark cannot be kept", () => {
    blockStorageWrites();
    recover(MISSING_CODE);

    // Without the mark an automatic reload could repeat forever, so there is none.
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(screen.getByRole("heading")).toHaveTextContent("Green Goods couldn't open.");
    expect(trackErrorBoundary).toHaveBeenCalledTimes(1);

    fireEvent.click(reloadButton());
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("does not call a storage fault a lost connection", () => {
    recover(new Error("IndexedDB unavailable during sync"));

    expect(screen.getByRole("heading")).toHaveTextContent("Green Goods couldn't open.");
    comeBackOnline();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("begins again when it is handed a second failure", () => {
    const { rerender } = recover(new Error("First page failed"));
    expect(trackErrorBoundary).toHaveBeenCalledTimes(1);
    expect(window.location.reload).not.toHaveBeenCalled();

    rerender(appFailure(MISSING_CODE));

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(trackErrorBoundary).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a string", "Loader gave up", "Loader gave up"],
    [
      "a thrown response",
      { status: 404, statusText: "Not Found", data: "No such garden", internal: true },
      "404 Not Found: No such garden",
    ],
    ["nothing at all", undefined, "Unknown error"],
  ])("reports %s a route throws as an error", (_label, thrown, message) => {
    recover(thrown);

    expect(trackErrorBoundary).toHaveBeenCalledWith(
      expect.objectContaining({ message }),
      expect.objectContaining({ boundaryName: "RouteErrorBoundary:unknown" })
    );
  });

  it("shows the frame's screen where a presentation has none for the place", () => {
    // The website has no app screen, so a failure asking for one is the larger failure.
    renderBare(
      <PublicRecoveryViews>
        <ErrorRecovery
          error={new Error("Page failed")}
          view="screen"
          boundary="RouteErrorBoundary"
        />
      </PublicRecoveryViews>
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "This page could not be loaded"
    );
  });

  it("refuses to run without the entry's recovery screens", () => {
    expect(() =>
      renderBare(
        <ErrorRecovery
          error={new Error("Page failed")}
          view="frame"
          boundary="RouteErrorBoundary"
        />
      )
    ).toThrow("RecoveryViewsContext");
  });
});

describe("AppErrorBoundary", () => {
  it("shows the could-not-open scene with no provider or router, and clears the loading screen", () => {
    renderBare(
      <AppRecoveryViews>
        <AppErrorBoundary view="frame">
          <ThrowWhileRendering />
        </AppErrorBoundary>
      </AppRecoveryViews>
    );

    expect(window.__GG_MARK_BOOT_FAILED).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Green Goods couldn't open.");
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was lost.");
    // The report carries where in the tree it broke, and the screen carries none of it.
    expect(trackErrorBoundary).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Render failed" }),
      expect.objectContaining({
        boundaryName: "AppErrorBoundary:unknown",
        componentStack: expect.stringContaining("ThrowWhileRendering"),
      })
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("Render failed");

    fireEvent.click(reloadButton());
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("speaks the language the app would have chosen, and declares it", () => {
    window.localStorage.setItem("gg-language", "pt");
    renderBare(
      <AppRecoveryViews>
        <AppErrorBoundary view="frame">
          <ThrowWhileRendering />
        </AppErrorBoundary>
      </AppRecoveryViews>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("O Green Goods não pôde abrir.");
    expect(screen.getByRole("alert")).toHaveAttribute("lang", "pt");
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeInTheDocument();
  });

  // The app's own choice: the stored language, else the first browser language with copy, else English.
  it.each([
    { stored: null, browser: ["es-MX"], language: "es" },
    { stored: null, browser: ["fr-FR", "pt-BR"], language: "pt" },
    { stored: "pt", browser: ["es-MX"], language: "pt" },
    { stored: "fr", browser: ["es-MX"], language: "en" },
  ])("chooses $language for a stored $stored and a browser on $browser", ({
    stored,
    browser,
    language,
  }) => {
    if (stored) window.localStorage.setItem("gg-language", stored);
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(browser);

    expect(recoveryLanguage()).toBe(language);
  });

  // Each entry hands over its own screens from outside every boundary, so a failure of
  // everything inside it still has a screen to show, and it is that presentation's.
  it.each([
    ["website", () => import("../../bootstrapPublic"), "This page could not be loaded"],
    ["installed app", () => import("../../bootstrapPwa"), "Green Goods couldn't open."],
  ])("the %s entry recovers with its own screen when all inside it fails", async (_name, load, words) => {
    const { default: Entry } = await load();
    renderBare(<Entry />);

    expect(screen.getByRole("alert")).toHaveTextContent(words);
    expect(screen.getByRole("alert")).not.toHaveTextContent("failed to start");

    fireEvent.click(reloadButton());
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});

// Where a failing route surfaces in the real route tables is in routes/routeFailures.test.tsx.
describe("boundaries inside the app's routes", () => {
  it("reports a garden page's render failure under its own name, with Back and no diagnostics", () => {
    renderWithProviders(
      <AppRecoveryViews>
        <MemoryRouter initialEntries={["/home/0x1111111111111111111111111111111111111111"]}>
          <AppErrorBoundary view="screen" name="GardenErrorBoundary">
            <ThrowWhileRendering />
          </AppErrorBoundary>
        </MemoryRouter>
      </AppRecoveryViews>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This screen didn't load");
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Render failed");
    expect(trackErrorBoundary).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ boundaryName: "GardenErrorBoundary:unknown" })
    );
  });

  // The garden's page stays mounted while the person moves between its child pages, so its
  // boundary outlives the page that failed.
  it("draws the garden again once the person leaves the page that failed", async () => {
    function GardenPage() {
      const { pathname } = useLocation();
      return (
        <AppErrorBoundary view="screen" name="GardenErrorBoundary" resetKey={pathname}>
          <p>Garden tabs</p>
          <Outlet />
        </AppErrorBoundary>
      );
    }
    const router = createMemoryRouter(
      [
        {
          path: "/home/:id",
          element: <GardenPage />,
          children: [{ path: "work/:workId", element: <ThrowWhileRendering /> }],
        },
      ],
      { initialEntries: ["/home/garden"] }
    );
    renderWithProviders(
      <AppRecoveryViews>
        <RouterProvider router={router} />
      </AppRecoveryViews>
    );

    await act(() => router.navigate("/home/garden/work/1"));

    expect(screen.getByRole("alert")).toHaveTextContent("This screen didn't load");
    // The page failed as it arrived. It is not drawn a second time, so it is reported once.
    expect(trackErrorBoundary).toHaveBeenCalledTimes(1);

    await act(() => router.navigate(-1));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Garden tabs")).toBeInTheDocument();
  });

  it("keeps the one-shot reload mark while only the route root has committed", () => {
    markChunkReloadAttempt();

    renderBare(
      <MemoryRouter>
        <Root />
      </MemoryRouter>
    );

    expect(hasChunkReloadAttempt()).toBe(true);
  });
});

declare global {
  interface Window {
    __GG_MARK_BOOT_FAILED?: () => void;
  }
}
