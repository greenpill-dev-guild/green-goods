/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initTheme, setTheme } from "../../../utils/styles/theme";

const STATIC_METAS = (light: string, dark: string) => `
  <meta name="theme-color" content="${light}" media="(prefers-color-scheme: light)" data-theme-color-scheme="light" />
  <meta name="theme-color" content="${dark}" media="(prefers-color-scheme: dark)" data-theme-color-scheme="dark" />
`;

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

function themeColorMetas(): HTMLMetaElement[] {
  return Array.from(document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
}

describe("utils/styles/theme", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = "";
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
    document.head.innerHTML = STATIC_METAS("#ffffff", "#0c0a09");

    setTheme("dark");

    // Browsers take the first theme-color meta that matches, so the selection
    // has to sit ahead of the OS-keyed pair and carry no media query.
    const [active, ...rest] = themeColorMetas();
    expect(active.hasAttribute("data-theme-color-active")).toBe(true);
    expect(active.hasAttribute("media")).toBe(false);
    expect(active.content).toBe("#0c0a09");
    expect(rest).toHaveLength(2);
  });

  it("updates the one active meta as the selection changes", () => {
    document.head.innerHTML = STATIC_METAS("#ffffff", "#0c0a09");

    setTheme("dark");
    setTheme("light");

    const metas = themeColorMetas();
    expect(metas).toHaveLength(3);
    expect(metas[0].content).toBe("#ffffff");
  });

  it("reuses the meta the pre-paint script already placed", () => {
    document.head.innerHTML = `<meta name="theme-color" data-theme-color-active content="#ffffff" />${STATIC_METAS("#ffffff", "#0c0a09")}`;
    localStorage.setItem("theme", "dark");

    initTheme();

    const metas = themeColorMetas();
    expect(metas).toHaveLength(3);
    expect(metas[0].content).toBe("#0c0a09");
  });

  it("follows the OS scheme while the theme is system", () => {
    document.head.innerHTML = STATIC_METAS("#ffffff", "#0c0a09");
    mockSystemScheme(true);

    setTheme("system");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(themeColorMetas()[0].content).toBe("#0c0a09");
  });

  it("keeps a build that pins one color for both schemes pinned", () => {
    document.head.innerHTML = STATIC_METAS("#111b13", "#111b13");

    setTheme("light");
    expect(themeColorMetas()[0].hasAttribute("data-theme-color-active")).toBe(true);
    expect(themeColorMetas()[0].content).toBe("#111b13");

    setTheme("dark");
    expect(themeColorMetas()[0].content).toBe("#111b13");
  });

  it("boots through a corrupted stored theme without touching theme-color", () => {
    document.head.innerHTML = STATIC_METAS("#ffffff", "#0c0a09");
    localStorage.setItem("theme", 'dark"]');

    // initTheme runs at module top level in the app entry, so a throw here
    // would take the whole boot down.
    expect(() => initTheme()).not.toThrow();
    expect(themeColorMetas()).toHaveLength(2);
  });

  it("leaves a document without scheme-tagged metas alone", () => {
    document.head.innerHTML = `<meta name="theme-color" content="#ffffff" />`;

    setTheme("dark");

    const metas = themeColorMetas();
    expect(metas).toHaveLength(1);
    expect(metas[0].hasAttribute("data-theme-color-active")).toBe(false);
    expect(metas[0].content).toBe("#ffffff");
  });
});
