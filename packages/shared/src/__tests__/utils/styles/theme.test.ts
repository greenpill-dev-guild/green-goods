/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initTheme, setTheme } from "../../../utils/styles/theme";

const THEME_COLOR_META = (light: string, dark: string) =>
  `<meta name="theme-color" content="${light}" data-light="${light}" data-dark="${dark}" />`;

function mockSystemScheme(dark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: dark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

function themeColor(): string | undefined {
  return document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
}

describe("utils/styles/theme", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = THEME_COLOR_META("#ffffff", "#0c0a09");
    delete document.documentElement.dataset.theme;
    mockSystemScheme(false);
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("stamps the selected theme on the root and persists it", () => {
    setTheme("dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("points theme-color at the selected theme when the OS scheme disagrees", () => {
    setTheme("dark");

    expect(themeColor()).toBe("#0c0a09");
  });

  it("moves theme-color back as the selection changes", () => {
    setTheme("dark");
    setTheme("light");

    expect(themeColor()).toBe("#ffffff");
  });

  it("applies the stored theme on init", () => {
    localStorage.setItem("theme", "dark");

    initTheme();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(themeColor()).toBe("#0c0a09");
  });

  it("follows the OS scheme while the theme is system", () => {
    mockSystemScheme(true);

    setTheme("system");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(themeColor()).toBe("#0c0a09");
  });

  it("keeps a build that ships one color for both schemes pinned", () => {
    document.head.innerHTML = THEME_COLOR_META("#111b13", "#111b13");

    setTheme("light");
    expect(themeColor()).toBe("#111b13");

    setTheme("dark");
    expect(themeColor()).toBe("#111b13");
  });

  it("boots through a corrupted stored theme without writing a bogus color", () => {
    localStorage.setItem("theme", "not-a-theme");

    // initTheme runs at module top level in the app entry, so a throw here would
    // take the whole boot down, and an unmatched value must leave the tag alone
    // rather than stamp "undefined" into it.
    expect(() => initTheme()).not.toThrow();
    expect(themeColor()).toBe("#ffffff");
  });

  it("leaves a document without the color attributes alone", () => {
    document.head.innerHTML = `<meta name="theme-color" content="#ffffff" />`;

    setTheme("dark");

    expect(themeColor()).toBe("#ffffff");
  });
});
