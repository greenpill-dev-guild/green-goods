/** @vitest-environment jsdom */
// jsdom pin (happy-dom A/B): happy-dom 20 matches `:not(:has(...))` even when the descendant is present.
// TEST-QUALITY: allow-small-test-file - The selector case needs jsdom, and bootFallback.test.tsx, which covers the presentation detector, runs in happy-dom.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const INDEX_CSS = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("the installed app's face in index.css", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete document.documentElement.dataset.bootPresentation;
  });

  it("sets Plus Jakarta Sans on the PWA presentation and leaves website content in Inter", () => {
    expect(INDEX_CSS).toMatch(/:root\s*\{[^}]*font-family:\s*Inter,/);
    const rule = INDEX_CSS.match(/(:root\[data-boot-presentation="pwa"\][^{]*)\{([^}]*)\}/);
    expect(rule?.[2]).toMatch(/font-family:\s*"Plus Jakarta Sans"/);
    const selector = rule?.[1].trim() ?? "";
    const root = document.documentElement;

    root.dataset.bootPresentation = "pwa";
    expect(root.matches(selector)).toBe(true);
    // A public page rendered in the PWA presentation keeps the website's Inter.
    document.body.innerHTML = '<main data-site="website"></main>';
    expect(root.matches(selector)).toBe(false);
    document.body.innerHTML = "";
    root.dataset.bootPresentation = "website";
    expect(root.matches(selector)).toBe(false);
  });
});
