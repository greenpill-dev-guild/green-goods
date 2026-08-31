import type { ComponentType } from "react";

export type ClientBootstrapPresentation = "public" | "pwa";

export function getBootPresentation(root: HTMLElement = document.documentElement) {
  return root.dataset.bootPresentation === "pwa" ? "pwa" : "public";
}

export function loadClientBootstrap(
  presentation: ClientBootstrapPresentation
): Promise<{ default: ComponentType }> {
  return presentation === "pwa" ? import("../bootstrapPwa") : import("../bootstrapPublic");
}
