/**
 * @vitest-environment jsdom
 */

import type { LoaderFunctionArgs } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import {
  requirePwaPresentationLoader,
  requireWebsitePresentationLoader,
} from "../../routes/presentation-mode";

const originalNavigator = global.navigator;
const originalWindow = global.window;

interface MockNavigator {
  userAgent: string;
  maxTouchPoints?: number;
  platform?: string;
  standalone?: boolean;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
}

function createMatchMedia(matcher: (query: string) => boolean = () => false): Window["matchMedia"] {
  return ((query: string) =>
    ({
      matches: matcher(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as Window["matchMedia"];
}

function mockNavigator(props: MockNavigator): void {
  Object.defineProperty(global, "navigator", {
    value: props,
    writable: true,
    configurable: true,
  });
}

function mockWindow(
  props: Omit<Partial<Window>, "location" | "matchMedia"> & {
    location?: Partial<Location>;
    matchMedia?: Window["matchMedia"];
  } = {}
): void {
  Object.defineProperty(global, "window", {
    value: {
      location: { hostname: "www.greengoods.app" },
      navigator: global.navigator,
      matchMedia: createMatchMedia(),
      ...props,
    },
    writable: true,
    configurable: true,
  });
}

function loaderArgs(url: string): LoaderFunctionArgs {
  return {
    request: new Request(url),
    params: {},
  } as LoaderFunctionArgs;
}

function expectRedirect(result: unknown, location: string): void {
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe(location);
}

function setWebsiteMode() {
  mockNavigator({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    maxTouchPoints: 0,
    platform: "MacIntel",
  });
  mockWindow({ location: { hostname: "www.greengoods.app" } });
}

function setLocalDevicePreviewMode() {
  mockNavigator({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    maxTouchPoints: 5,
    platform: "Linux armv8l",
    userAgentData: { mobile: true, platform: "Android" },
  });
  mockWindow({ location: { hostname: "localhost" } });
}

function setStandaloneMode() {
  mockNavigator({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    maxTouchPoints: 0,
    platform: "MacIntel",
  });
  mockWindow({
    location: { hostname: "www.greengoods.app" },
    matchMedia: createMatchMedia((query) => query === "(display-mode: standalone)"),
  });
}

describe("presentation-mode route guards", () => {
  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it("allows website mode to render the public root", () => {
    setWebsiteMode();

    expect(requireWebsitePresentationLoader(loaderArgs("https://www.greengoods.app/"))).toBeNull();
  });

  it("redirects localhost device-preview root to /home", () => {
    setLocalDevicePreviewMode();

    const result = requireWebsitePresentationLoader(loaderArgs("http://localhost:3001/"));

    expectRedirect(result, "/home");
  });

  it("honors internal redirectTo values for PWA root redirects", () => {
    setLocalDevicePreviewMode();

    const result = requireWebsitePresentationLoader(
      loaderArgs(
        `http://localhost:3001/?redirectTo=${encodeURIComponent("/garden?draft=1#upload")}`
      )
    );

    expectRedirect(result, "/garden?draft=1#upload");
  });

  it.each([
    "https://example.com/phish",
    "//example.com/phish",
    "javascript:alert(1)",
    "home",
    "/",
  ])("falls back to /home for unsafe redirectTo value %s", (redirectTo) => {
    setLocalDevicePreviewMode();

    const result = requireWebsitePresentationLoader(
      loaderArgs(`http://localhost:3001/?redirectTo=${encodeURIComponent(redirectTo)}`)
    );

    expectRedirect(result, "/home");
  });

  it.each([
    "/login",
    "/home",
    "/garden",
    "/profile",
  ])("redirects website mode %s to the public website", (path) => {
    setWebsiteMode();

    const result = requirePwaPresentationLoader(loaderArgs(`https://www.greengoods.app${path}`));

    expectRedirect(result, "/");
  });

  it.each([
    "/login",
    "/home",
    "/garden",
    "/profile",
  ])("allows local device-preview PWA route %s", (path) => {
    setLocalDevicePreviewMode();

    expect(requirePwaPresentationLoader(loaderArgs(`http://localhost:3001${path}`))).toBeNull();
  });

  it("allows standalone PWA routes", () => {
    setStandaloneMode();

    expect(requirePwaPresentationLoader(loaderArgs("https://www.greengoods.app/home"))).toBeNull();
  });
});
