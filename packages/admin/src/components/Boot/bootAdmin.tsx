import { clearPersistedQueryClient } from "@green-goods/shared/config/query-persistence";
import { logger } from "@green-goods/shared/modules/app/logger";
import { initTheme } from "@green-goods/shared/utils/styles/theme";
import { type ComponentType, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ADMIN_QUERY_PERSISTENCE_DB } from "./bootConstants";
import { BootErrorBoundary, BootRecovery, BootShell } from "./BootSurface";

/**
 * Admin boot sequence.
 *
 * The old entry did everything at module top level — persister construction,
 * theme, Sentry, global handlers, IPFS — before `root.render`. Any throw in
 * that graph (a blocked `window.localStorage`, a Sentry integration, a shared
 * module's own top-level code) failed the whole module and left `#root`
 * empty with nothing on screen and nobody listening. This module inverts the
 * order: record failures first, put a visible shell in the root second, load
 * the application tree third, and start every optional service last inside
 * its own guard so none of them can take the workspace down.
 */

export type BootStage =
  | "theme"
  | "load-root"
  | "render"
  | "sentry"
  | "error-handlers"
  | "ipfs"
  | "runtime";

export interface BootFailure {
  stage: BootStage;
  message: string;
  at: number;
}

export interface BootDiagnostics {
  failures: BootFailure[];
}

export interface AdminBootServices {
  loadRoot: () => Promise<{ default: ComponentType }>;
  initTheme: () => (() => void) | undefined;
  initSentry: () => void | Promise<void>;
  initErrorHandlers: () => void | Promise<void>;
  initIpfs: () => Promise<unknown>;
}

export interface BootAdminOptions {
  /** Defaults to `#root`. Tests pass their own container. */
  container?: HTMLElement | null;
  services?: Partial<AdminBootServices>;
}

export type BootOutcome =
  | { status: "mounted"; diagnostics: BootDiagnostics; unmount: () => void }
  | {
      status: "failed";
      stage: BootStage;
      error: unknown;
      diagnostics: BootDiagnostics;
      unmount: () => void;
    };

declare global {
  interface Window {
    __ADMIN_ROOT__?: Root;
    __GG_ADMIN_BOOT__?: BootDiagnostics;
  }
}

const MAX_RECORDED_FAILURES = 20;

const defaultServices: AdminBootServices = {
  loadRoot: () => import("./AdminRoot"),
  initTheme,
  initSentry: async () => {
    const { initBrowserSentry } = await import("@green-goods/shared/sentry");
    initBrowserSentry({
      dsn: import.meta.env.VITE_SENTRY_ADMIN_DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION
        ? `green-goods-admin@${import.meta.env.VITE_APP_VERSION}`
        : undefined,
      surface: "admin",
      debug: import.meta.env.VITE_SENTRY_DEBUG === "true",
    });
  },
  initErrorHandlers: async () => {
    // Catches unhandled errors and promise rejections that escape Error
    // Boundaries and forwards them to PostHog/Sentry exception tracking.
    const { initGlobalErrorHandlers } = await import(
      "@green-goods/shared/modules/app/error-events"
    );
    initGlobalErrorHandlers();
  },
  initIpfs: async () => {
    const { initializeIpfsFromEnv } = await import("@green-goods/shared/modules/data/ipfs/client");
    return initializeIpfsFromEnv(import.meta.env);
  },
};

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function recordFailure(diagnostics: BootDiagnostics, stage: BootStage, error: unknown): void {
  const failure: BootFailure = { stage, message: describe(error), at: Date.now() };
  if (diagnostics.failures.length < MAX_RECORDED_FAILURES) diagnostics.failures.push(failure);
  logger.error("[admin-boot] startup step failed", {
    source: "bootAdmin",
    stage,
    message: failure.message,
  });
}

let diagnosticsInstalled = false;

/**
 * Boot-level error capture, installed before anything else runs. It records
 * what went wrong so the recovery surface can show it and the PostHog/Sentry
 * handlers, which arrive later, do not have to be alive to see a boot failure.
 */
function installBootDiagnostics(): BootDiagnostics {
  // One record per boot; the page-level listeners are installed once and
  // always write into whichever boot is current.
  const diagnostics: BootDiagnostics = { failures: [] };
  window.__GG_ADMIN_BOOT__ = diagnostics;
  if (!diagnosticsInstalled) {
    diagnosticsInstalled = true;
    const current = () => window.__GG_ADMIN_BOOT__ ?? diagnostics;
    window.addEventListener("error", (event) => {
      recordFailure(current(), "runtime", event.error ?? event.message);
    });
    window.addEventListener("unhandledrejection", (event) => {
      recordFailure(current(), "runtime", event.reason);
    });
  }
  return diagnostics;
}

function attempt<T>(diagnostics: BootDiagnostics, stage: BootStage, run: () => T): T | undefined {
  try {
    return run();
  } catch (error) {
    recordFailure(diagnostics, stage, error);
    return undefined;
  }
}

async function attemptAsync(
  diagnostics: BootDiagnostics,
  stage: BootStage,
  run: () => unknown
): Promise<void> {
  try {
    await run();
  } catch (error) {
    recordFailure(diagnostics, stage, error);
  }
}

function afterFirstPaint(task: () => void): void {
  const raf =
    typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0);
  raf(() => window.setTimeout(task, 0));
}

function reload(): void {
  window.location.reload();
}

async function resetAndReload(): Promise<void> {
  await clearPersistedQueryClient({ dbName: ADMIN_QUERY_PERSISTENCE_DB });
  reload();
}

/** Last resort when React itself cannot render: plain DOM, no dependencies. */
function renderStaticRecovery(container: HTMLElement, error: unknown): void {
  container.replaceChildren();
  const card = document.createElement("div");
  card.setAttribute("role", "alert");
  card.dataset.component = "AdminBootRecovery";
  card.dataset.state = "failed";
  card.style.cssText =
    "min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;text-align:center;font-family:system-ui,sans-serif";
  const title = document.createElement("h1");
  title.textContent = "Green Goods Admin could not start";
  const body = document.createElement("p");
  body.textContent = describe(error);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Reload";
  button.addEventListener("click", reload);
  card.append(title, body, button);
  container.append(card);
}

/**
 * Start the optional services once the workspace is on screen. Sequential and
 * individually guarded: Sentry, the PostHog global handlers, then IPFS.
 */
async function startOptionalServices(
  services: AdminBootServices,
  diagnostics: BootDiagnostics
): Promise<void> {
  await attemptAsync(diagnostics, "sentry", services.initSentry);
  await attemptAsync(diagnostics, "error-handlers", services.initErrorHandlers);
  await attemptAsync(diagnostics, "ipfs", services.initIpfs);
}

export async function bootAdmin(options: BootAdminOptions = {}): Promise<BootOutcome> {
  const services: AdminBootServices = { ...defaultServices, ...options.services };
  const container = options.container ?? document.getElementById("root");
  if (!container) throw new Error("Root container not found");

  const diagnostics = installBootDiagnostics();

  // Reuse the HMR-preserved root only on the default container; a caller that
  // supplies its own container gets its own root.
  const reuse = options.container ? undefined : window.__ADMIN_ROOT__;
  let root: Root;
  try {
    root = reuse ?? createRoot(container);
    root.render(<BootShell />);
  } catch (error) {
    recordFailure(diagnostics, "render", error);
    renderStaticRecovery(container, error);
    return { status: "failed", stage: "render", error, diagnostics, unmount: () => undefined };
  }
  if (!options.container) window.__ADMIN_ROOT__ = root;

  const cleanupTheme = attempt(diagnostics, "theme", services.initTheme);
  const unmount = () => {
    cleanupTheme?.();
    root.unmount();
    if (!options.container) delete window.__ADMIN_ROOT__;
  };

  const recovery = (error: unknown) => (
    <BootRecovery error={error} onReload={reload} onReset={() => void resetAndReload()} />
  );

  let RootComponent: ComponentType;
  try {
    RootComponent = (await services.loadRoot()).default;
  } catch (error) {
    recordFailure(diagnostics, "load-root", error);
    root.render(recovery(error));
    return { status: "failed", stage: "load-root", error, diagnostics, unmount };
  }

  root.render(
    <StrictMode>
      <BootErrorBoundary
        fallback={recovery}
        onError={(error) => recordFailure(diagnostics, "render", error)}
      >
        <RootComponent />
      </BootErrorBoundary>
    </StrictMode>
  );

  afterFirstPaint(() => {
    void startOptionalServices(services, diagnostics);
  });

  if (import.meta.hot && !options.container) {
    import.meta.hot.dispose(() => {
      unmount();
    });
  }

  return { status: "mounted", diagnostics, unmount };
}
