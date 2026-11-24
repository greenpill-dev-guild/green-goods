/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it } from "vitest";
import { initTheme, setTheme } from "../../../utils/styles/theme";

// jsdom reports no dark preference, so the OS scheme reads light throughout:
// selecting dark here is always the case where the selection and the OS disagree.
function themeColor(): string | undefined {
  return document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
}

describe("utils/styles/theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = `<meta name="theme-color" content="#ffffff" data-light="#ffffff" data-dark="#0c0a09" data-app-light="#faf8f5" data-app-dark="#110c08" />`;
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.bootPresentation;
  });

  it("points theme-color at the selected theme rather than the OS scheme", () => {
    setTheme("dark");

    expect(themeColor()).toBe("#0c0a09");
  });

  it("gives the installed app its own ground in either theme", () => {
    document.documentElement.dataset.bootPresentation = "pwa";

    setTheme("light");
    expect(themeColor()).toBe("#faf8f5");

    setTheme("dark");
    expect(themeColor()).toBe("#110c08");
  });

  it("applies the stored theme on init", () => {
    localStorage.setItem("theme", "dark");

    initTheme();

    expect(themeColor()).toBe("#0c0a09");
  });

  it("leaves the tag alone when no color matches the resolved theme", () => {
    // The stored theme is unvalidated and initTheme runs at module top level in
    // the app entry, so an unmatched value must neither throw during boot nor
    // write "undefined" into the tag.
    document.head.innerHTML = `<meta name="theme-color" content="#ffffff" />`;
    localStorage.setItem("theme", "not-a-theme");

    expect(() => initTheme()).not.toThrow();
    expect(themeColor()).toBe("#ffffff");
  });
});
