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

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  useApp: mockUseApp,
  useInstallGuidance: mockUseInstallGuidance,
  usePublicInstallHandler: mockUsePublicInstallHandler,
  useIsBraveBrowser: mockUseIsBraveBrowser,
  useTunnelUrl: () => null,
  getOpenInBrowserUrl: mockGetOpenInBrowserUrl,
}));

import { PublicInstallAction } from "../../components/Public/PublicInstallAction";

const CHROME_INTENT =
  "intent://www.greengoods.app/#Intent;scheme=https;package=com.android.chrome;end";

function renderAction() {
  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages: {}, onError: () => {} },
      createElement(PublicInstallAction, null, ({ label, onClick }) =>
        createElement("button", { type: "button", onClick, "data-testid": "cta" }, label)
      )
    )
  );
}

describe("PublicInstallAction — Brave install (PRD-499)", () => {
  beforeEach(() => {
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

  afterEach(() => cleanup());

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
});
