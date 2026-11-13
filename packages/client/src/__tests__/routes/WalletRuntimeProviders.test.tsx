/**
 * @vitest-environment happy-dom
 */

import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuthState = vi.fn();
const mockUseApp = vi.fn();
const mockAppKitProvider = vi.fn();

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => mockUseAuthState(),
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => mockUseApp(),
}));

vi.mock("@green-goods/shared/providers/AppKitProvider", () => ({
  AppKitProvider: (props: { children: ReactNode }) => {
    mockAppKitProvider(props);
    return props.children;
  },
}));

vi.mock("@green-goods/shared/providers/AuthGate", () => ({
  AuthGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@green-goods/shared/hooks/analytics/useAnalyticsIdentity", () => ({
  useAnalyticsIdentity: vi.fn(),
}));

import WalletRuntimeProviders, { PwaStartupReadySignal } from "../../routes/WalletRuntimeProviders";

describe("WalletRuntimeProviders return fallback", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthState.mockReturnValue({ isReady: false });
    mockUseApp.mockReturnValue({ isStandalone: true, platform: "android" });
    vi.stubEnv("VITE_APP_URL", "https://www.greengoods.app");
    vi.stubEnv("VITE_USE_HASH_ROUTER", "false");
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    vi.unstubAllEnvs();
  });

  it.each([
    "https://www.greengoods.app",
    "https://beta.greengoods.app",
    "https://preview.example.test",
    "https://localhost:3001",
  ])("returns an installed Android PWA to its own origin at %s", (origin) => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL(`${origin}/home/garden?draft=private#step`),
    });

    render(<WalletRuntimeProviders analyticsIdentity={false}>App</WalletRuntimeProviders>);

    expect(mockAppKitProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          redirect: { native: `${origin}/home/`, universal: `${origin}/home/` },
        }),
      })
    );
  });

  it.each([
    [
      "https://gateway.example/ipfs/bafy-garden/#/home/garden?draft=private",
      "https://gateway.example/ipfs/bafy-garden/#/home",
    ],
    [
      "https://gateway.example/ipfs/bafy-garden/index.html#/home/garden",
      "https://gateway.example/ipfs/bafy-garden/#/home",
    ],
    [
      "https://bafy-garden.ipfs.gateway.example/#/home/garden",
      "https://bafy-garden.ipfs.gateway.example/#/home",
    ],
  ])("preserves the IPFS document base when returning from %s", (currentUrl, returnUrl) => {
    vi.stubEnv("VITE_USE_HASH_ROUTER", "true");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL(currentUrl),
    });

    render(<WalletRuntimeProviders analyticsIdentity={false}>App</WalletRuntimeProviders>);

    expect(mockAppKitProvider.mock.calls[0]?.[0].metadata.redirect).toEqual({
      native: returnUrl,
      universal: returnUrl,
    });
  });

  it.each([
    { isStandalone: false, platform: "android" },
    { isStandalone: true, platform: "ios" },
    { isStandalone: true, platform: "unknown" },
  ])("keeps other wallet return behavior unchanged for %o", (app) => {
    mockUseApp.mockReturnValue(app);

    render(<WalletRuntimeProviders analyticsIdentity={false}>App</WalletRuntimeProviders>);

    expect(mockAppKitProvider.mock.calls[0]?.[0].metadata).not.toHaveProperty("redirect");
  });
});

describe("PwaStartupReadySignal", () => {
  const clearBootFallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as Window & { __GG_CLEAR_BOOT_FALLBACK?: () => void }).__GG_CLEAR_BOOT_FALLBACK =
      clearBootFallback;
  });

  afterEach(() => {
    delete (window as Window & { __GG_CLEAR_BOOT_FALLBACK?: () => void }).__GG_CLEAR_BOOT_FALLBACK;
  });

  it("clears the static surface only after authentication is ready", () => {
    mockUseAuthState.mockReturnValue({ isReady: false });
    const view = render(<PwaStartupReadySignal />);

    expect(clearBootFallback).not.toHaveBeenCalled();

    mockUseAuthState.mockReturnValue({ isReady: true });
    view.rerender(<PwaStartupReadySignal />);

    expect(clearBootFallback).toHaveBeenCalledTimes(1);
  });
});
