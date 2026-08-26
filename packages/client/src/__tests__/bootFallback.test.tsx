/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INDEX_HTML = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

function inlineScript(id: string): string {
  const match = INDEX_HTML.match(
    new RegExp(`<script id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`)
  );
  if (!match?.[1]) throw new Error(`Missing inline script ${id}`);
  return match[1];
}

function bootMarkup(): string {
  const match = INDEX_HTML.match(
    /<div id=["']root["'][^>]*><\/div>([\s\S]*?)<script id=["']boot-fallback-controller["']/
  );
  if (!match?.[1]) throw new Error("Missing boot fallback markup");
  return `<div id="root"></div>${match[1]}`;
}

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  } as Storage;
}

function detectPresentation({
  href,
  displayMode,
  navigator: navigatorOverrides = {},
}: {
  href: string;
  displayMode?: "standalone" | "window-controls-overlay" | "fullscreen";
  navigator?: Partial<Navigator> & { standalone?: boolean; userAgentData?: { mobile?: boolean } };
}): string | undefined {
  const dataset: DOMStringMap = {};
  const navigator = {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    platform: "MacIntel",
    maxTouchPoints: 0,
    ...navigatorOverrides,
  } as Navigator;
  const windowLike = {
    location: new URL(href),
    navigator,
    sessionStorage: createStorage(),
    matchMedia: (query: string) => ({
      matches: displayMode ? query === `(display-mode: ${displayMode})` : false,
    }),
  };
  const documentLike = { documentElement: { dataset } };

  new Function(
    "window",
    "document",
    "navigator",
    "URL",
    inlineScript("boot-presentation-detector")
  )(windowLike, documentLike, navigator, URL);

  return dataset.bootPresentation;
}

function runController(presentation: "website" | "pwa") {
  document.body.innerHTML = bootMarkup();
  document.documentElement.dataset.bootPresentation = presentation;

  new Function(
    "window",
    "document",
    "navigator",
    "MutationObserver",
    "URL",
    inlineScript("boot-fallback-controller")
  )(window, document, navigator, MutationObserver, URL);

  return {
    fallback: document.getElementById("boot-fallback") as HTMLElement,
    website: document.getElementById("boot-fallback-website") as HTMLElement,
    pwa: document.getElementById("boot-fallback-pwa") as HTMLElement,
    websiteRecovery: document.getElementById("boot-website-recovery") as HTMLElement,
    pwaMessage: document.getElementById("boot-pwa-message") as HTMLElement,
  };
}

describe("presentation-specific boot fallback", () => {
  it("keeps the static document shell structurally valid", () => {
    expect(INDEX_HTML.match(/<body>/g)).toHaveLength(1);
    expect(INDEX_HTML.match(/<\/body>/g)).toHaveLength(1);
    expect(INDEX_HTML).toContain('class="boot-editorial-logo"');
    expect(INDEX_HTML).toContain('src="%BASE_URL%icon.png"');
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete document.documentElement.dataset.bootPresentation;
    delete (window as Window & { __GG_CLEAR_BOOT_FALLBACK?: () => void }).__GG_CLEAR_BOOT_FALLBACK;
  });

  it("keeps production public routes in website mode, including standalone windows", () => {
    expect(detectPresentation({ href: "https://www.greengoods.app/gardens" })).toBe("website");
    expect(
      detectPresentation({
        href: "https://www.greengoods.app/impact",
        displayMode: "standalone",
      })
    ).toBe("website");
  });

  it.each([
    "standalone",
    "window-controls-overlay",
    "fullscreen",
  ] as const)("selects the PWA loader for an installed %s app route", (displayMode) => {
    expect(detectPresentation({ href: "https://www.greengoods.app/home", displayMode })).toBe(
      "pwa"
    );
  });

  it("supports iOS standalone and localhost device preview without using viewport width", () => {
    expect(
      detectPresentation({
        href: "https://www.greengoods.app/home",
        navigator: { standalone: true },
      })
    ).toBe("pwa");
    expect(
      detectPresentation({
        href: "http://localhost:3001/",
        navigator: {
          userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile",
          platform: "Linux armv8l",
          maxTouchPoints: 5,
          userAgentData: { mobile: true },
        },
      })
    ).toBe("pwa");
    expect(detectPresentation({ href: "http://localhost:3001/" })).toBe("website");
  });

  it("honors explicit localhost presentation overrides", () => {
    expect(detectPresentation({ href: "http://localhost:3001/?presentation=pwa" })).toBe("pwa");
    expect(
      detectPresentation({
        href: "http://localhost:3001/?presentation=website",
        displayMode: "standalone",
      })
    ).toBe("website");
  });

  it("reveals the website skeleton after 200ms with no loading live region", () => {
    const { fallback, website } = runController("website");

    expect(fallback).toHaveAttribute("hidden");
    vi.advanceTimersByTime(199);
    expect(fallback).toHaveAttribute("hidden");
    vi.advanceTimersByTime(1);

    expect(fallback).not.toHaveAttribute("hidden");
    expect(fallback).toHaveAttribute("data-state", "loading");
    expect(website).toHaveAttribute("aria-hidden", "true");
    expect(fallback).not.toHaveAttribute("role");
    expect(fallback).not.toHaveAttribute("aria-live");
  });

  it("shows the PWA loader immediately", () => {
    const { fallback, pwa, pwaMessage } = runController("pwa");

    expect(fallback).not.toHaveAttribute("hidden");
    expect(pwa).toHaveAttribute("role", "status");
    expect(pwa).toHaveAttribute("aria-live", "polite");
    expect(pwaMessage).toHaveTextContent("Green Goods is loading.");
  });

  it("clears before the website delay when React mounts quickly", () => {
    const { fallback } = runController("website");
    document.getElementById("root")?.append(document.createElement("main"));

    (window as Window & { __GG_CLEAR_BOOT_FALLBACK?: () => void }).__GG_CLEAR_BOOT_FALLBACK?.();
    vi.advanceTimersByTime(200);

    expect(fallback).toHaveAttribute("hidden");
  });

  it("turns a slow website load into an actionable editorial recovery state", () => {
    const { fallback, websiteRecovery } = runController("website");

    vi.advanceTimersByTime(4500);

    expect(fallback).not.toHaveAttribute("hidden");
    expect(fallback).toHaveAttribute("data-state", "recovery");
    expect(websiteRecovery).not.toHaveAttribute("hidden");
    expect(websiteRecovery).toHaveAttribute("role", "alert");
    expect(websiteRecovery).toHaveTextContent("This page is taking longer than expected.");
    expect(websiteRecovery.querySelector("button")).toHaveTextContent("Reload");
  });

  it("shows website recovery immediately when the module load fails", () => {
    const { fallback, websiteRecovery } = runController("website");

    document.dispatchEvent(new Event("gg-module-load-failed"));

    expect(fallback).not.toHaveAttribute("hidden");
    expect(fallback).toHaveAttribute("data-state", "recovery");
    expect(websiteRecovery).not.toHaveAttribute("hidden");
  });

  it("preserves the PWA update recovery message", () => {
    const { fallback, pwaMessage } = runController("pwa");

    vi.advanceTimersByTime(4500);

    expect(fallback).toHaveAttribute("data-state", "recovery");
    expect(pwaMessage).toHaveTextContent("Green Goods needs the latest app files.");
  });
});
