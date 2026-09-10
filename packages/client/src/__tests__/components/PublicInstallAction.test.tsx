/**
 * PublicInstallAction — Brave-on-Android install interception (PRD-499).
 *
 * Brave on Android omits the "Brave" UA token, so `detectMobileBrowser` sees
 * Chrome and offers a native install that silently creates a home-screen
 * shortcut. The component uses the async `useIsBraveBrowser` signal to warn and
 * steer to Chrome before the install proceeds.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseApp,
  mockUseInstallGuidance,
  mockUsePublicInstallHandler,
  mockInstallHandler,
  mockUseIsBraveBrowser,
  mockGetOpenInBrowserUrl,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  mockUseInstallGuidance: vi.fn(),
  mockUsePublicInstallHandler: vi.fn(),
  mockInstallHandler: vi.fn(),
  mockUseIsBraveBrowser: vi.fn(),
  mockGetOpenInBrowserUrl: vi.fn(),
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: mockUseApp,
}));

vi.mock("@green-goods/shared/hooks/app/useInstallGuidance", () => ({
  useInstallGuidance: mockUseInstallGuidance,
}));

vi.mock("@green-goods/shared/hooks/app/usePublicInstallHandler", () => ({
  usePublicInstallHandler: mockUsePublicInstallHandler,
}));

vi.mock("@green-goods/shared/hooks/app/useIsBraveBrowser", () => ({
  useIsBraveBrowser: mockUseIsBraveBrowser,
}));

vi.mock("@green-goods/shared/hooks/app/useTunnelUrl", () => ({
  useTunnelUrl: () => null,
}));

vi.mock("@green-goods/shared/utils/app/browser", () => ({
  getOpenInBrowserUrl: mockGetOpenInBrowserUrl,
}));

import {
  PublicInstallAction,
  type PublicInstallActionRenderProps,
} from "../../components/Public/PublicInstallAction";

import { PublicInstallCta } from "../../components/Public/PublicInstallCta";

const CHROME_INTENT =
  "intent://www.greengoods.app/#Intent;scheme=https;package=com.android.chrome;end";

function setLocation(path: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(path, "http://localhost:3000"),
  });
}

function actionElement(destination?: string) {
  return createElement(
    IntlProvider,
    { locale: "en", messages: {}, onError: () => {} },
    createElement(PublicInstallAction, {
      destination,
      children: ({
        label,
        href,
        onClick,
        disabled,
        dataInstallAction,
        hasInstallFallback,
        fallbackLabel,
        onInstallFallbackClick,
      }: PublicInstallActionRenderProps) =>
        createElement(
          "div",
          null,
          createElement(
            "a",
            {
              href,
              "aria-disabled": disabled || undefined,
              onClick,
              "data-install-action": dataInstallAction,
              "data-testid": "cta",
            },
            label
          ),
          hasInstallFallback
            ? createElement(
                "button",
                {
                  type: "button",
                  onClick: onInstallFallbackClick,
                  "data-testid": "fallback",
                },
                fallbackLabel
              )
            : null
        ),
    })
  );
}

function renderAction(destination?: string) {
  return render(actionElement(destination));
}

describe("PublicInstallAction", () => {
  beforeEach(() => {
    localStorage.clear();
    setLocation("/");
    vi.clearAllMocks();
    mockUsePublicInstallHandler.mockReturnValue(mockInstallHandler);
    mockGetOpenInBrowserUrl.mockReturnValue(CHROME_INTENT);
    // Brave on Android is detected as Chrome, so guidance offers a native install.
    mockUseInstallGuidance.mockReturnValue({
      scenario: "native-prompt-available",
      primaryAction: { type: "native-install", label: "Install App" },
      secondaryAction: null,
      browserInfo: { browser: "chrome" },
      showBrowserOption: true,
      manualInstructions: null,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("intercepts the install tap on Brave/Android and surfaces the Chrome dialog", () => {
    mockUseIsBraveBrowser.mockReturnValue(true);
    mockUseApp.mockReturnValue({
      isMobile: true,
      platform: "android",
      isInstalled: false,
      wasInstalled: false,
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });

    renderAction();
    fireEvent.click(screen.getByTestId("cta"));

    // The warning dialog opens instead of firing the native install.
    expect(screen.getByText("Install Green Goods in Chrome")).toBeInTheDocument();
    const openInChrome = screen.getByText("Open in Chrome").closest("a");
    expect(openInChrome).toHaveAttribute("href", CHROME_INTENT);
    expect(mockInstallHandler).not.toHaveBeenCalled();
  });

  it("does not intercept non-Brave Android — the native install proceeds", () => {
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({
      isMobile: true,
      platform: "android",
      isInstalled: false,
      wasInstalled: false,
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });

    renderAction();
    fireEvent.click(screen.getByTestId("cta"));

    expect(mockInstallHandler).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Install Green Goods in Chrome")).not.toBeInTheDocument();
  });

  it("renders a disabled installing state while Chrome finishes installation", () => {
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({
      isMobile: true,
      platform: "android",
      isInstalled: false,
      isInstalling: true,
      wasInstalled: false,
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });
    mockUseInstallGuidance.mockReturnValue({
      scenario: "installing",
      primaryAction: { type: "installing", label: "Installing..." },
      secondaryAction: null,
      browserInfo: { browser: "chrome" },
      showBrowserOption: false,
      manualInstructions: null,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    });

    renderAction();

    const cta = screen.getByTestId("cta");
    expect(cta).toHaveAttribute("aria-disabled", "true");
    expect(cta).toHaveTextContent("Installing...");
    expect(cta).toHaveAttribute("data-install-action", "installing");
  });

  it("uses the current origin for Open App links", () => {
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({
      isMobile: true,
      platform: "android",
      isInstalled: true,
      isInstalling: false,
      wasInstalled: true,
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });
    mockUseInstallGuidance.mockReturnValue({
      scenario: "already-installed",
      primaryAction: { type: "open-app", label: "Open App" },
      secondaryAction: null,
      browserInfo: { browser: "chrome" },
      showBrowserOption: false,
      manualInstructions: null,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    });

    renderAction();

    expect(screen.getByTestId("cta")).toHaveAttribute("href", "/home");
    expect(screen.getByTestId("cta")).toHaveAttribute("data-install-action", "open-app");
    expect(fireEvent.click(screen.getByTestId("cta"))).toBe(true);
  });

  it("keeps Open App primary for remembered Android installs and exposes reinstall help", () => {
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({
      isMobile: true,
      platform: "android",
      isInstalled: false,
      isInstalling: false,
      wasInstalled: true,
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });
    mockUseInstallGuidance.mockReturnValue({
      scenario: "already-installed",
      primaryAction: { type: "open-app", label: "Open App" },
      secondaryAction: { type: "show-manual-steps", label: "Install Again" },
      browserInfo: { browser: "chrome" },
      showBrowserOption: true,
      manualInstructions: [
        {
          stepNumber: 1,
          icon: "menu",
          title: "Step 1",
          description: "Tap **Menu**.",
        },
      ],
      browserSwitchReason: null,
      openInBrowserUrl: null,
    });

    renderAction();

    expect(screen.getByTestId("cta")).toHaveTextContent("Open App");
    expect(screen.getByTestId("fallback")).toHaveTextContent("Install Again");

    fireEvent.click(screen.getByTestId("fallback"));

    expect(screen.getByText("Install Green Goods on this phone")).toBeInTheDocument();
    expect(mockInstallHandler).not.toHaveBeenCalled();
  });
  it("keeps the shared work destination on the app-opening anchor", () => {
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({ isMobile: true, platform: "android", isInstalled: true });
    const destination = `/home/0x${"1".repeat(40)}/work/0x${"2".repeat(64)}`;
    renderAction(destination);
    expect(screen.getByTestId("cta")).toHaveAttribute("href", destination);
  });

  it("remembers the record when installation is requested", () => {
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({ isMobile: true, platform: "android", isInstalled: false });
    const destination = `/home/0x${"1".repeat(40)}`;
    renderAction(destination);
    fireEvent.click(screen.getByTestId("cta"));
    expect(JSON.parse(localStorage.getItem("gg-pending-shared-link")!).path).toBe(destination);
    expect(mockInstallHandler).toHaveBeenCalled();
  });
  it("keeps an explicit continuation when installation evidence is inconclusive", () => {
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({
      isMobile: true,
      platform: "android",
      isInstalled: false,
      installedAppEvidence: "unknown",
      deferredPrompt: null,
    });
    mockUseInstallGuidance.mockReturnValue({
      primaryAction: { type: "show-manual-steps", label: "Install App" },
      manualInstructions: [],
    });
    const destination = `/home/0x${"1".repeat(40)}/work/0x${"2".repeat(64)}`;
    render(
      createElement(
        IntlProvider,
        { locale: "en", messages: {}, onError: () => {} },
        createElement(PublicInstallCta, { variant: "compact", destination })
      )
    );
    expect(screen.getByRole("link", { name: "Open This Work in the App" })).toHaveAttribute(
      "href",
      destination
    );
    expect(screen.getByText(/keep reading here without installing/)).toBeInTheDocument();
  });
  it("remembers a QR arrival before any in-page install interaction", () => {
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({ isMobile: true, platform: "android", isInstalled: false });
    const garden = `0x${"1".repeat(40)}`;
    const work = `0x${"2".repeat(64)}`;
    setLocation(`/gardens/${garden}/work/${work}`);
    renderAction();
    expect(JSON.parse(localStorage.getItem("gg-pending-shared-link")!).path).toBe(
      `/home/${garden}/work/${work}`
    );
    expect(mockInstallHandler).not.toHaveBeenCalled();
  });

  it("refreshes both Android browser-switch paths after SPA navigation", () => {
    mockUseIsBraveBrowser.mockReturnValue(true);
    mockUseApp.mockReturnValue({ isMobile: true, platform: "android", isInstalled: false });
    mockGetOpenInBrowserUrl.mockImplementation((_platform, _browser, url) => `intent:${url}`);
    mockUseInstallGuidance.mockReturnValue({
      primaryAction: { type: "open-in-browser", label: "Open in Chrome" },
      openInBrowserUrl: "intent:stale-homepage",
    });
    const view = renderAction();
    const destination = `/home/0x${"1".repeat(40)}/work/0x${"2".repeat(64)}`;
    setLocation(destination.replace("/home/", "/gardens/"));
    view.rerender(actionElement());
    fireEvent.click(screen.getByTestId("cta"));
    expect(screen.getByRole("link", { name: "Open in Chrome" })).toHaveAttribute(
      "href",
      `intent:${window.location.origin}${destination}`
    );
    expect(mockUsePublicInstallHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        openInBrowserUrl: `intent:${window.location.origin}${destination}`,
      }),
      undefined
    );
  });

  it("uses document navigation for both hash-router app-opening controls", () => {
    vi.stubEnv("VITE_USE_HASH_ROUTER", "true");
    mockUseIsBraveBrowser.mockReturnValue(false);
    mockUseApp.mockReturnValue({ isMobile: true, platform: "android", isInstalled: true });
    const destination = `/home/0x${"1".repeat(40)}/work/0x${"2".repeat(64)}`;
    setLocation(`/ipfs/cid/?pwaLaunch=1#${destination.replace("/home/", "/gardens/")}`);
    const source = new URL(window.location.href);
    render(
      createElement(
        IntlProvider,
        { locale: "en", messages: {}, onError: () => {} },
        createElement(PublicInstallCta, { variant: "compact", destination })
      )
    );
    for (const name of ["Open App", "Open This Work in the App"]) {
      const link = screen.getByRole("link", { name });
      const target = new URL(link.getAttribute("href")!, source);
      expect(target.pathname).toBe(source.pathname);
      expect(target.search).not.toBe(source.search);
      expect(target.hash).toBe(`#${destination}`);
    }
  });
});
