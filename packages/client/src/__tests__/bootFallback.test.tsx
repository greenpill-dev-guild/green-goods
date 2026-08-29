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

function inlineStyle(id: string): string {
  const match = INDEX_HTML.match(new RegExp(`<style id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/style>`));
  if (!match?.[1]) throw new Error(`Missing inline style ${id}`);
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

interface DetectOptions {
  href: string;
  displayMode?: "standalone" | "window-controls-overlay" | "fullscreen";
  navigator?: Partial<Navigator> & { standalone?: boolean; userAgentData?: { mobile?: boolean } };
}

function detectBootDataset({
  href,
  displayMode,
  navigator: navigatorOverrides = {},
}: DetectOptions): DOMStringMap {
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

  return dataset;
}

function detectPresentation(options: DetectOptions): string | undefined {
  return detectBootDataset(options).bootPresentation;
}

type BootWindow = Pick<Window, "addEventListener" | "clearTimeout" | "setTimeout"> & {
  __GG_CLEAR_BOOT_FALLBACK?: () => void;
  location: Pick<Location, "href" | "reload" | "replace">;
};

type BootNavigator = {
  language: string;
  onLine: boolean;
  serviceWorker?: {
    addEventListener: ReturnType<typeof vi.fn>;
    getRegistration: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
};

function createBootWindow() {
  const location = {
    href: "https://staging.greengoods.app/home",
    reload: vi.fn(),
    replace: vi.fn(),
  };
  const windowLike = {
    addEventListener: window.addEventListener.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    location,
    setTimeout: window.setTimeout.bind(window),
  } as BootWindow;

  return { location, windowLike };
}

function createServiceWorkerContainer(registration: Record<string, unknown> | null) {
  const listeners: Record<string, EventListener[]> = {};
  const serviceWorker = {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    }),
    getRegistration: vi.fn().mockResolvedValue(registration),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== listener);
    }),
  };

  return {
    dispatchControllerChange: () => {
      listeners.controllerchange?.forEach((listener) => listener(new Event("controllerchange")));
    },
    serviceWorker,
  };
}

function createRegistration({
  installing = null,
  waiting = null,
}: {
  installing?: Record<string, unknown> | null;
  waiting?: Record<string, unknown> | null;
} = {}) {
  const listeners: Record<string, EventListener[]> = {};
  const registration = {
    installing,
    unregister: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    waiting,
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== listener);
    }),
  };

  return {
    dispatchUpdateFound: () => {
      listeners.updatefound?.forEach((listener) => listener(new Event("updatefound")));
    },
    registration,
  };
}

function createWorker(state: ServiceWorkerState = "installed") {
  const listeners: Record<string, EventListener[]> = {};
  const worker = {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== listener);
    }),
  };

  return {
    dispatchStateChange: () => {
      listeners.statechange?.forEach((listener) => listener(new Event("statechange")));
    },
    worker,
  };
}

function runController(
  presentation: "website" | "pwa",
  options: {
    navigator?: BootNavigator;
    window?: BootWindow;
  } = {}
) {
  document.body.innerHTML = bootMarkup();
  document.documentElement.dataset.bootPresentation = presentation;

  const windowLike = options.window ?? (window as unknown as BootWindow);
  const navigatorLike = options.navigator ?? (navigator as unknown as BootNavigator);

  new Function(
    "window",
    "document",
    "navigator",
    "MutationObserver",
    "URL",
    inlineScript("boot-fallback-controller")
  )(windowLike, document, navigatorLike, MutationObserver, URL);

  return {
    fallback: document.getElementById("boot-fallback") as HTMLElement,
    website: document.getElementById("boot-fallback-website") as HTMLElement,
    pwa: document.getElementById("boot-fallback-pwa") as HTMLElement,
    websiteRecovery: document.getElementById("boot-website-recovery") as HTMLElement,
    pwaMessage: document.getElementById("boot-pwa-message") as HTMLElement,
    pwaReload: document.getElementById("boot-pwa-reload") as HTMLButtonElement,
    clearFallback: windowLike.__GG_CLEAR_BOOT_FALLBACK,
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

  it("keys the website skeleton hero variant off the pathname", () => {
    expect(detectBootDataset({ href: "https://www.greengoods.app/" }).bootHero).toBe("fullscreen");
    expect(detectBootDataset({ href: "https://www.greengoods.app/landing" }).bootHero).toBe(
      "fullscreen"
    );
    expect(detectBootDataset({ href: "https://www.greengoods.app/impact" }).bootHero).toBe(
      "banner"
    );
    expect(detectBootDataset({ href: "https://www.greengoods.app/gardens/0xabc" }).bootHero).toBe(
      "banner"
    );
    expect(detectBootDataset({ href: "http://localhost:3001/actions" }).bootHero).toBe("banner");
    // PWA boots never render the website skeleton, so no variant is stamped.
    expect(
      detectBootDataset({ href: "https://www.greengoods.app/home", displayMode: "standalone" })
        .bootHero
    ).toBeUndefined();
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
    const slots = Array.from(pwa.querySelectorAll("[data-boot-slot]")).map((slot) =>
      slot.getAttribute("data-boot-slot")
    );

    expect(fallback).not.toHaveAttribute("hidden");
    expect(pwa).toHaveAttribute("role", "status");
    expect(pwa).toHaveAttribute("aria-live", "polite");
    expect(pwaMessage).toHaveTextContent("Green Goods is loading.");
    expect(pwa.querySelector("img")).toHaveAttribute("src", "%BASE_URL%icon.png");
    expect(slots).toEqual(["logo", "message", "action"]);
  });

  it("uses the white PWA canvas and fixed boot-state rows", () => {
    const styles = inlineStyle("boot-fallback-styles");

    expect(styles).toMatch(
      /html\[data-boot-presentation="pwa"\] #boot-fallback\s*{[^}]*--boot-canvas:\s*var\(--color-static-white, #ffffff\)/s
    );
    expect(styles).toMatch(
      /\.boot-pwa-shell\s*{[^}]*background:\s*var\(--color-static-white, #ffffff\)[^}]*color:\s*var\(--color-static-black, #1f2a24\)/s
    );
    expect(styles).not.toMatch(
      /(?:html\[data-boot-presentation="pwa"\] #boot-fallback|\.boot-pwa-shell)\s*{[^}]*--color-bg-white-0/s
    );
    expect(styles).toMatch(
      /\.boot-pwa-content\s*{[^}]*display:\s*grid[^}]*grid-template-rows:\s*64px 144px 68px/s
    );
    expect(styles).toMatch(
      /\.boot-pwa-message-slot\s*{[^}]*block-size:\s*144px[^}]*overflow-y:\s*auto/s
    );
    expect(styles).toMatch(/\.boot-pwa-action-slot\s*{[^}]*block-size:\s*68px/s);
  });

  it.each([
    ["es-MX", "Green Goods se está cargando."],
    ["pt-BR", "Green Goods está carregando."],
  ])("publishes the %s loading copy for the React handoff", (language, message) => {
    runController("pwa", {
      navigator: { language, onLine: true },
    });

    expect(document.documentElement.dataset.bootLoadingMessage).toBe(message);
  });

  it("clears before the website delay when React mounts quickly", () => {
    const { clearFallback, fallback } = runController("website");
    document.getElementById("root")?.append(document.createElement("main"));

    clearFallback?.();
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
    vi.advanceTimersByTime(200);

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

  it("activates a waiting worker before reloading the failed PWA boot", async () => {
    const { worker } = createWorker();
    const { registration } = createRegistration({ waiting: worker });
    const { dispatchControllerChange, serviceWorker } = createServiceWorkerContainer(registration);
    const { location, windowLike } = createBootWindow();
    const { fallback, pwaMessage, pwaReload } = runController("pwa", {
      navigator: { language: "en", onLine: true, serviceWorker },
      window: windowLike,
    });
    vi.advanceTimersByTime(4500);

    pwaReload.click();
    pwaReload.click();
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled());

    expect(fallback).toHaveAttribute("data-state", "applying");
    expect(pwaMessage).toHaveTextContent("Updating Green Goods…");
    expect(pwaReload).toHaveAttribute("aria-disabled", "true");
    expect(serviceWorker.addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
      { once: true }
    );
    expect(serviceWorker.addEventListener.mock.invocationCallOrder.at(-1)).toBeLessThan(
      worker.postMessage.mock.invocationCallOrder[0]
    );
    expect(location.reload).not.toHaveBeenCalled();
    expect(serviceWorker.getRegistration).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);

    dispatchControllerChange();

    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(registration.unregister).not.toHaveBeenCalled();
  });

  it("checks for an update and activates the worker that finishes installing", async () => {
    const installing = createWorker("installing");
    const { registration, dispatchUpdateFound } = createRegistration();
    registration.update.mockImplementation(async () => {
      registration.installing = installing.worker;
      dispatchUpdateFound();
    });
    const { serviceWorker } = createServiceWorkerContainer(registration);
    const { windowLike } = createBootWindow();
    const { pwaReload } = runController("pwa", {
      navigator: { language: "en", onLine: true, serviceWorker },
      window: windowLike,
    });
    vi.advanceTimersByTime(4500);

    pwaReload.click();
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));

    registration.waiting = installing.worker;
    installing.worker.state = "installed";
    installing.dispatchStateChange();

    expect(installing.worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(installing.worker.postMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps an offline user and their app data safe when no update is waiting", async () => {
    const { registration } = createRegistration();
    const { serviceWorker } = createServiceWorkerContainer(registration);
    const { location, windowLike } = createBootWindow();
    const navigatorLike: BootNavigator = { language: "en", onLine: false, serviceWorker };
    const { fallback, pwaMessage, pwaReload } = runController("pwa", {
      navigator: navigatorLike,
      window: windowLike,
    });
    vi.advanceTimersByTime(4500);

    pwaReload.click();
    await vi.waitFor(() => expect(fallback).toHaveAttribute("data-state", "stalled"));

    expect(pwaMessage).toHaveTextContent("You’re offline. Reconnect, then try again.");
    expect(pwaReload).toHaveTextContent("Try again");
    expect(pwaReload).toHaveAttribute("aria-disabled", "false");
    expect(registration.update).not.toHaveBeenCalled();
    expect(registration.unregister).not.toHaveBeenCalled();
    expect(location.reload).not.toHaveBeenCalled();

    navigatorLike.onLine = true;
    pwaReload.click();
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));
  });

  it("offers a retry when the worker registration is missing or the update check fails", async () => {
    const missing = createServiceWorkerContainer(null);
    const missingWindow = createBootWindow();
    const missingView = runController("pwa", {
      navigator: { language: "en", onLine: true, serviceWorker: missing.serviceWorker },
      window: missingWindow.windowLike,
    });
    vi.advanceTimersByTime(4500);

    missingView.pwaReload.click();
    await vi.waitFor(() => expect(missingView.fallback).toHaveAttribute("data-state", "stalled"));
    expect(missingView.pwaReload).toHaveTextContent("Try again");
    expect(missingWindow.location.reload).not.toHaveBeenCalled();

    const { registration } = createRegistration();
    registration.update.mockRejectedValue(new Error("update failed"));
    const failed = createServiceWorkerContainer(registration);
    const failedWindow = createBootWindow();
    const failedView = runController("pwa", {
      navigator: { language: "en", onLine: true, serviceWorker: failed.serviceWorker },
      window: failedWindow.windowLike,
    });
    vi.advanceTimersByTime(4500);

    failedView.pwaReload.click();
    await vi.waitFor(() => expect(failedView.fallback).toHaveAttribute("data-state", "stalled"));
    expect(failedView.pwaReload).toHaveTextContent("Try again");
    expect(registration.unregister).not.toHaveBeenCalled();
    expect(failedWindow.location.reload).not.toHaveBeenCalled();
  });

  it("stops after a bounded update attempt instead of silently reloading", async () => {
    const { registration } = createRegistration();
    const { serviceWorker } = createServiceWorkerContainer(registration);
    const { location, windowLike } = createBootWindow();
    const { fallback, pwaMessage, pwaReload } = runController("pwa", {
      navigator: { language: "en", onLine: true, serviceWorker },
      window: windowLike,
    });
    vi.advanceTimersByTime(4500);

    pwaReload.click();
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(15_000);

    expect(fallback).toHaveAttribute("data-state", "stalled");
    expect(pwaMessage).toHaveTextContent(
      "The update didn’t finish. Close and reopen Green Goods, or try again."
    );
    expect(pwaReload).toHaveTextContent("Try again");
    expect(registration.unregister).not.toHaveBeenCalled();
    expect(location.reload).not.toHaveBeenCalled();
  });

  it("uses transparent recovery artwork and ships every recovery state in three languages", () => {
    const { pwa } = runController("pwa");
    const controller = inlineScript("boot-fallback-controller");

    expect(pwa.querySelector("img")).toHaveAttribute("src", "%BASE_URL%icon.png");
    expect(INDEX_HTML).toContain('applying: "Actualizando Green Goods…"');
    expect(INDEX_HTML).toContain('applying: "Atualizando o Green Goods…"');
    expect(INDEX_HTML).toContain('retry: "Intentar de nuevo"');
    expect(INDEX_HTML).toContain('retry: "Tentar novamente"');
    expect(controller).not.toContain(".unregister(");
    expect(controller).not.toContain("caches.delete");
    expect(controller).not.toContain("deleteDatabase");
    expect(controller).not.toContain("localStorage.clear");
    expect(controller).not.toContain("sessionStorage.clear");
  });

  it("removes update listeners when React mounts during recovery", async () => {
    const { worker } = createWorker();
    const { registration } = createRegistration({ waiting: worker });
    const { dispatchControllerChange, serviceWorker } = createServiceWorkerContainer(registration);
    const { location, windowLike } = createBootWindow();
    const { clearFallback, fallback, pwaReload } = runController("pwa", {
      navigator: { language: "en", onLine: true, serviceWorker },
      window: windowLike,
    });
    vi.advanceTimersByTime(4500);
    pwaReload.click();
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(1));

    document.getElementById("root")?.append(document.createElement("main"));
    clearFallback?.();
    dispatchControllerChange();

    expect(fallback).toHaveAttribute("data-state", "cleared");
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function)
    );
    expect(location.reload).not.toHaveBeenCalled();
  });
});
