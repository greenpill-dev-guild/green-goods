import type { ComponentType } from "react";

export type ClientBootstrapPresentation = "public" | "pwa";

export function getBootPresentation(root: HTMLElement = document.documentElement) {
  return root.dataset.bootPresentation === "pwa" ? "pwa" : "public";
}

export function loadClientBootstrap(
  presentation: ClientBootstrapPresentation
): Promise<{ default: ComponentType }> {
  if (presentation === "pwa") return import("../bootstrapPwa");
  const bootstrap = import("../bootstrapPublic");
  if (typeof window !== "undefined") {
    const hashRouter = import.meta.env.VITE_USE_HASH_ROUTER === "true";
    const path = hashRouter
      ? window.location.hash.slice(1).split("?")[0] || "/"
      : window.location.pathname;
    const base = hashRouter
      ? ""
      : new URL(import.meta.env.BASE_URL, window.location.href).pathname.replace(/\/$/, "");
    if (path === `${base}/` || path === `${base}/index.html`) {
      // Start the homepage's route closure alongside its bootstrap. The router
      // still owns rendering and import-failure recovery; no auth runtime is warmed.
      void Promise.allSettled([import("../routes/PublicShell"), import("../views/Public/Home")]);
    }
  }
  return bootstrap;
}
