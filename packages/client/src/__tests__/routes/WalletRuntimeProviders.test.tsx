/**
 * @vitest-environment happy-dom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuthState = vi.fn();
const mockUseApp = vi.fn();
const mockAppKitProvider = vi.fn();
const mockOpenfortProvider = vi.fn();

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => mockUseAuthState(),
  useWalletReconnectPrompt: vi.fn(),
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

vi.mock("@green-goods/shared/providers/OpenfortWalletProvider", () => ({
  OpenfortWalletProvider: (props: { children: ReactNode }) => {
    mockOpenfortProvider(props);
    return props.children;
  },
}));

vi.mock("@green-goods/shared/providers/AuthGate", () => ({
  AuthGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@green-goods/shared/hooks/analytics/useAnalyticsIdentity", () => ({
  useAnalyticsIdentity: vi.fn(),
}));

import PublicWalletRuntimeProviders from "../../components/Public/PublicWalletRuntimeProviders";
import WalletRuntimeProviders, { PwaStartupReadySignal } from "../../routes/WalletRuntimeProviders";

describe("WalletRuntimeProviders return fallback", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthState.mockReturnValue({ isReady: false });
    mockUseApp.mockReturnValue({
      isPwaPresentation: true,
      isStandalone: true,
      platform: "android",
    });
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

  // PRD-1523: Rabby crops the icon to fill a square or round frame, which cut the
  // outer arcs off the wide 819×464 mark.
  it("gives wallets a square icon the App serves", () => {
    render(<WalletRuntimeProviders analyticsIdentity={false}>App</WalletRuntimeProviders>);

    const [icon] = mockAppKitProvider.mock.calls[0]?.[0].metadata.icons as string[];
    const file = readFileSync(
      resolve(__dirname, "../../../public", new URL(icon).pathname.slice(1))
    );
    // A PNG's IHDR chunk holds the width and the height as big-endian 32-bit integers.
    expect(file.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(file.readUInt32BE(16)).toBe(file.readUInt32BE(20));
  });

  it.each([
    { isStandalone: false, platform: "android" },
    { isStandalone: true, platform: "ios" },
    { isStandalone: true, platform: "unknown" },
  ])("keeps other wallet return behavior unchanged for %o", (app) => {
    mockUseApp.mockReturnValue({ ...app, isPwaPresentation: true });

    render(<WalletRuntimeProviders analyticsIdentity={false}>App</WalletRuntimeProviders>);

    expect(mockAppKitProvider.mock.calls[0]?.[0].metadata).not.toHaveProperty("redirect");
  });
});

it("uses Openfort for wallet sign-in on the public website", () => {
  vi.clearAllMocks();
  mockUseApp.mockReturnValue({ isPwaPresentation: false });
  render(
    <PublicWalletRuntimeProviders analyticsIdentity={false}>Website</PublicWalletRuntimeProviders>
  );
  expect(mockOpenfortProvider).toHaveBeenCalledOnce();
  expect(mockAppKitProvider).not.toHaveBeenCalled();
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
