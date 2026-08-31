import { initGlobalErrorHandlers } from "@green-goods/shared/modules/app/error-events";
import { initTheme } from "@green-goods/shared/utils/styles/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
  createPwaRoutingConfig,
  PWA_APP_SCOPE,
  PWA_DEV_SERVICE_WORKER_SCRIPT,
} from "@/config/pwaRouting";
import { getBootPresentation, loadClientBootstrap } from "@/config/bootstrap";

import "@/index.css";
import "@/config";

initTheme();
initGlobalErrorHandlers();

function runAfterLoadAndIdle(task: () => void) {
  const run = () => {
    const idleCallback =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback) => window.setTimeout(callback));
    idleCallback(task);
  };

  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}

function initializeDeferredRuntime() {
  runAfterLoadAndIdle(() => {
    void import("@green-goods/shared/sentry").then(({ initBrowserSentry }) => {
      initBrowserSentry({
        dsn: import.meta.env.VITE_SENTRY_CLIENT_DSN,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        release: import.meta.env.VITE_APP_VERSION
          ? `green-goods-client@${import.meta.env.VITE_APP_VERSION}`
          : undefined,
        surface: "client",
        debug: import.meta.env.VITE_SENTRY_DEBUG === "true",
      });
    });
  });

  runAfterLoadAndIdle(() => {
    void import("@green-goods/shared/service-worker").then(({ registerServiceWorkerFromEnv }) => {
      const pwaRouting = createPwaRoutingConfig(import.meta.env.VITE_USE_HASH_ROUTER === "true");
      const devServiceWorkerEnabled =
        import.meta.env.DEV && import.meta.env.VITE_ENABLE_SW_DEV === "true";
      return registerServiceWorkerFromEnv(
        {
          DEV: import.meta.env.MODE !== "production",
          PROD: import.meta.env.MODE === "production",
          VITE_ENABLE_SW_DEV: import.meta.env.VITE_ENABLE_SW_DEV,
          VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
        },
        {
          scriptUrl: devServiceWorkerEnabled
            ? PWA_DEV_SERVICE_WORKER_SCRIPT
            : pwaRouting.serviceWorkerScriptUrl,
          scope: pwaRouting.manifestScope,
          legacyScopes: pwaRouting.manifestScope === PWA_APP_SCOPE ? ["/"] : [],
        }
      );
    });
  });
}

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing in index.html");

const { default: Bootstrap } = await loadClientBootstrap(getBootPresentation());
createRoot(container).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);
initializeDeferredRuntime();

const markReactMounted = (window as Window & { __GG_MARK_REACT_MOUNTED?: () => void })
  .__GG_MARK_REACT_MOUNTED;
if (markReactMounted) window.requestAnimationFrame(() => markReactMounted());
