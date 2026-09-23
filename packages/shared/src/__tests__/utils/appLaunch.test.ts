/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createAndroidAppLaunchUrl, consumeAppLaunchFallback } from "../../utils/app/browser";

beforeEach(() => {
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
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("Android app launch", () => {
  it("keeps the app destination and encodes the originating page as browser fallback", () => {
    const source = `${window.location.origin}/gardens?sort=new#field-notes`;
    const path = `/home/0x${"1".repeat(40)}/work/0x${"2".repeat(64)}`;
    const intent = createAndroidAppLaunchUrl(`${window.location.origin}${path}`, source, {
      left: 0,
      top: 720,
    });
    expect(intent).toContain(`intent://${window.location.host}${path}#Intent;scheme=http;`);
    expect(intent).not.toContain("package=");
    const fallback = new URL(
      decodeURIComponent(intent.split("S.browser_fallback_url=")[1].split(";end")[0])
    );
    expect(fallback.pathname).toBe("/gardens");
    expect(fallback.searchParams.get("sort")).toBe("new");
    expect(fallback.hash).toBe("#field-notes");
    window.history.replaceState({ key: "existing" }, "", fallback);
    expect(consumeAppLaunchFallback()).toEqual({ left: 0, top: 720 });
    expect(window.location.href).toBe(source);
    expect(window.history.state).toEqual({ key: "existing" });
    expect(consumeAppLaunchFallback()).toBeNull();
  });

  it.each([
    "https://other.example/home/",
    "javascript:alert(1)",
    `${window.location.origin}/gardens`,
  ])("does not wrap an out-of-scope destination in an intent: %s", (target) => {
    expect(createAndroidAppLaunchUrl(target, window.location.href)).toBe(target);
  });

  it("does not infer failure from a normal page load or malformed marker", () => {
    expect(consumeAppLaunchFallback()).toBeNull();
    window.history.replaceState(null, "", "/?ggAppLaunch=arbitrary&keep=yes#anchor");
    expect(consumeAppLaunchFallback()).toBeNull();
    expect(window.location.search).toBe("?keep=yes");
    expect(window.location.hash).toBe("#anchor");
  });
});
