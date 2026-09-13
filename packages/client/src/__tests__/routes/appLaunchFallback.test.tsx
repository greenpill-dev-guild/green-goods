/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { info: notify },
}));
vi.mock("@green-goods/shared/hooks/analytics/usePageView", () => ({ usePageView: vi.fn() }));
vi.mock("@green-goods/shared/components/Toast/ToastViewport", () => ({
  ToastViewport: () => <div data-testid="toasts" />,
}));
vi.mock("../../components/Navigation/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, ScrollRestoration: () => null };
});
import PublicShell from "../../routes/PublicShell";

function mount() {
  return render(
    <StrictMode>
      <IntlProvider locale="en">
        <MemoryRouter>
          <PublicShell />
        </MemoryRouter>
      </IntlProvider>
    </StrictMode>
  );
}
beforeEach(() => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL("http://localhost:3000/"),
  });
  // The repo setup replaces Location; reconnect history to that test double.
  vi.spyOn(window.history, "replaceState").mockImplementation((state, _unused, url) => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL(String(url), window.location.href),
    });
    Object.defineProperty(window.history, "state", { configurable: true, value: state });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  notify.mockClear();
  window.history.replaceState(null, "", "/");
});
it("shows the agreed toast once on explicit browser fallback, never again on reload", () => {
  window.history.replaceState(
    { key: "original" },
    "",
    "/?presentation=website&ggAppLaunch=0,720#details"
  );
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  const view = mount();
  expect(notify).toHaveBeenCalledExactlyOnceWith({
    id: "app-launch-unavailable",
    message: "Couldn’t open Green Goods. Open it from your apps.",
  });
  expect(window.location.search).toBe("?presentation=website");
  expect(window.location.hash).toBe("#details");
  expect(scroll).toHaveBeenCalledWith({ left: 0, top: 720, behavior: "instant" });
  view.unmount();
  mount();
  expect(notify).toHaveBeenCalledTimes(1);
});
it("does not show launch feedback on an ordinary visit", () => {
  mount();
  expect(notify).not.toHaveBeenCalled();
});
