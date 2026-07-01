/**
 * InstallCta Component Tests
 *
 * Tests the install call-to-action on Profile: shows install guidance
 * based on platform, hides when already installed, shows browser-switch
 * warnings for in-app browsers.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track mock state
const mockAppState = {
  isMobile: true,
  isInstalled: false,
  wasInstalled: false,
  deferredPrompt: null as any,
  promptInstall: vi.fn(),
  platform: "android" as string,
};

const mockGuidanceState = {
  scenario: "manual-instructions" as string,
  primaryAction: { type: "show-manual-steps" as string, label: "Install App" },
  manualInstructions: null as any,
  browserSwitchReason: null as string | null,
  openInBrowserUrl: null as string | null,
};

// Mock @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  copyToClipboard: vi.fn().mockResolvedValue(true),
  hapticLight: vi.fn(),
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  useApp: () => mockAppState,
  useInstallGuidance: () => mockGuidanceState,
}));

// Mock @remixicon/react
vi.mock("@remixicon/react", () => ({
  RiAlertLine: (props: any) => createElement("span", props),
  RiDownloadLine: (props: any) => createElement("span", props),
  RiExternalLinkLine: (props: any) => createElement("span", props),
  RiFileCopyLine: (props: any) => createElement("span", props),
  RiSmartphoneLine: (props: any) => createElement("span", props),
}));

// Mock client components
vi.mock("@/components/Actions", () => ({
  Button: ({ label, onClick }: { label: string; onClick?: () => void; [key: string]: unknown }) =>
    createElement("button", { onClick, "data-testid": `btn-${label}` }, label),
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "card" }, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

import { InstallCta } from "../../views/Profile/InstallCta";

const wrap = (el: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages: {} }, el);

describe("InstallCta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.isMobile = true;
    mockAppState.isInstalled = false;
    mockAppState.wasInstalled = false;
    mockAppState.platform = "android";
    mockGuidanceState.scenario = "manual-instructions";
    mockGuidanceState.primaryAction = { type: "show-manual-steps", label: "Install App" };
    mockGuidanceState.manualInstructions = null;
    mockGuidanceState.browserSwitchReason = null;
    mockGuidanceState.openInBrowserUrl = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("returns null when not on mobile", () => {
    mockAppState.isMobile = false;

    const { container } = render(wrap(createElement(InstallCta)));
    expect(container.innerHTML).toBe("");
  });

  it("returns null when already installed", () => {
    mockAppState.isInstalled = true;

    const { container } = render(wrap(createElement(InstallCta)));
    expect(container.innerHTML).toBe("");
  });

  it("returns null when guidance resolves to open-app (remembered install)", () => {
    mockAppState.wasInstalled = true;
    mockGuidanceState.scenario = "already-installed";
    mockGuidanceState.primaryAction = { type: "open-app", label: "Open App" };

    const { container } = render(wrap(createElement(InstallCta)));
    expect(container.innerHTML).toBe("");
  });

  it("shows install header on mobile when not installed", () => {
    render(wrap(createElement(InstallCta)));

    expect(screen.getByText("Install App")).toBeInTheDocument();
  });

  it("shows install card with default android instructions", () => {
    mockAppState.platform = "android";

    render(wrap(createElement(InstallCta)));

    expect(screen.getByText("Install Green Goods")).toBeInTheDocument();
    expect(screen.getByText(/open in chrome/i)).toBeInTheDocument();
  });

  it("shows iOS instructions when platform is iOS", () => {
    mockAppState.platform = "ios";

    render(wrap(createElement(InstallCta)));

    expect(screen.getByText(/share.*add to home screen/i)).toBeInTheDocument();
  });

  it("shows native install button when prompt is available", () => {
    mockGuidanceState.scenario = "native-prompt-available";

    render(wrap(createElement(InstallCta)));

    expect(screen.getByTestId("btn-Install")).toBeInTheDocument();
    expect(screen.getByText(/install for the best experience/i)).toBeInTheDocument();
  });

  it("shows wrong-browser warning with copy link button", () => {
    mockGuidanceState.scenario = "wrong-browser";
    mockGuidanceState.browserSwitchReason = "Please use Safari to install";

    render(wrap(createElement(InstallCta)));

    expect(screen.getByText("Switch Browser")).toBeInTheDocument();
    expect(screen.getByText("Please use Safari to install")).toBeInTheDocument();
    expect(screen.getByTestId("btn-Copy Link")).toBeInTheDocument();
  });

  it("shows in-app-browser warning with open in chrome button", () => {
    mockGuidanceState.scenario = "in-app-browser";
    mockGuidanceState.browserSwitchReason = "Open in a real browser";
    mockGuidanceState.openInBrowserUrl = "https://app.greengoods.app";

    render(wrap(createElement(InstallCta)));

    expect(screen.getByText("Open in Browser")).toBeInTheDocument();
    expect(screen.getByTestId("btn-Open in Chrome")).toBeInTheDocument();
  });
});
