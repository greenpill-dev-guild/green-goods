/**
 * @vitest-environment jsdom
 */

import type { LoaderFunctionArgs, RouteObject } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { appRoutes, CLIENT_ROUTE_IDS } from "../../router.config";
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

function createSessionStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } as Storage;
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
      sessionStorage: createSessionStorage(),
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

function findRouteById(routes: RouteObject[], id: string): RouteObject | undefined {
  for (const route of routes) {
    if (route.id === id) return route;
    const childMatch = route.children ? findRouteById(route.children, id) : undefined;
    if (childMatch) return childMatch;
  }

  return undefined;
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

function setLocalDesktopMode() {
  mockNavigator({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    maxTouchPoints: 0,
    platform: "MacIntel",
  });
  mockWindow({ location: { hostname: "localhost" } });
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

  it("keeps production public routes on the website shell even in standalone mode", () => {
    setStandaloneMode();

    for (const path of ["/", "/gardens", "/gardens/decleanup", "/impact", "/fund", "/actions"]) {
      expect(
        requireWebsitePresentationLoader(loaderArgs(`https://www.greengoods.app${path}`))
      ).toBeNull();
    }
  });

  it("allows localhost website override to render the public root", () => {
    setLocalDevicePreviewMode();

    expect(
      requireWebsitePresentationLoader(loaderArgs("http://localhost:3001/?presentation=website"))
    ).toBeNull();
  });

  it("redirects localhost device-preview root to /home", () => {
    setLocalDevicePreviewMode();

    const result = requireWebsitePresentationLoader(loaderArgs("http://localhost:3001/"));

    expectRedirect(result, "/home");
  });

  it("redirects localhost PWA override root to /home", () => {
    setLocalDesktopMode();

    const result = requireWebsitePresentationLoader(
      loaderArgs("http://localhost:3001/?presentation=pwa")
    );

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

  it("redirects /home with website override back to the public root", () => {
    setLocalDevicePreviewMode();

    const result = requirePwaPresentationLoader(
      loaderArgs("http://localhost:3001/home?presentation=website")
    );

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

  it("keeps /landing as a redirect-only public compatibility route", async () => {
    setLocalDesktopMode();

    const landingRoute = findRouteById(appRoutes, CLIENT_ROUTE_IDS.publicLanding);
    expect(landingRoute?.path).toBe("landing");
    expect(landingRoute?.lazy).toBeUndefined();
    expect(landingRoute?.loader).toBeTypeOf("function");

    const result = await (landingRoute!.loader as (args: LoaderFunctionArgs) => unknown)(
      loaderArgs("http://localhost:3001/landing?presentation=website")
    );

    expectRedirect(result, "/");
  });
});
