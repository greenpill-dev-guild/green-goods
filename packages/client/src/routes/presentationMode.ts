import { getClientPresentationMode } from "@green-goods/shared/utils/app/pwa";
import { redirect, type LoaderFunctionArgs } from "react-router-dom";
import { APP_ROUTES, LEGACY_APP_ROUTES } from "@/config/pwaRouting";

const PWA_ENTRY_ROUTE = APP_ROUTES.home;
const WEBSITE_ENTRY_ROUTE = "/";
const PUBLIC_WEBSITE_PATHS = new Set([
  "/",
  "/actions",
  "/cookies",
  "/fund",
  "/gardens",
  "/glossary",
  "/impact",
  "/landing",
  "/vaults",
]);
const PUBLIC_WEBSITE_PREFIXES = ["/gardens/"];

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function effectivePathname(url: URL): string {
  if (url.hash.startsWith("#/")) {
    try {
      return new URL(url.hash.slice(1), url.origin).pathname;
    } catch {
      return url.pathname;
    }
  }
  return url.pathname;
}

function isProductionPublicWebsiteUrl(url: URL): boolean {
  if (isLocalHostname(url.hostname)) return false;

  const pathname = normalizePathname(effectivePathname(url));
  return (
    PUBLIC_WEBSITE_PATHS.has(pathname) ||
    PUBLIC_WEBSITE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function getPresentationUrl(source?: string | URL): URL | null {
  if (source instanceof URL) return source;

  try {
    if (source) return new URL(source, "https://greengoods.local/");
    if (typeof window !== "undefined" && window.location.href) {
      return new URL(window.location.href);
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Resolves the shell that owns a URL. Public production routes remain website
 * pages even when opened from a standalone window; every other route follows
 * the shared installed/local-preview presentation contract.
 */
export function getClientRoutePresentationMode(source?: string | URL): "website" | "pwa" {
  const url = getPresentationUrl(source);
  if (url && isProductionPublicWebsiteUrl(url)) return "website";
  return getClientPresentationMode(source);
}

function getSafeInternalRedirect(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "https://greengoods.local");
    if (url.origin !== "https://greengoods.local") return null;
    if (url.pathname === WEBSITE_ENTRY_ROUTE) return null;
    const pathname =
      url.pathname === LEGACY_APP_ROUTES.login
        ? APP_ROUTES.login
        : url.pathname === LEGACY_APP_ROUTES.garden
          ? APP_ROUTES.garden
          : url.pathname === LEGACY_APP_ROUTES.profile
            ? APP_ROUTES.profile
            : url.pathname;
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function getPwaEntryRoute(request: Request): string {
  const url = new URL(request.url);
  if (url.pathname !== WEBSITE_ENTRY_ROUTE) return PWA_ENTRY_ROUTE;
  return getSafeInternalRedirect(url.searchParams.get("redirectTo")) || PWA_ENTRY_ROUTE;
}

export function requireWebsitePresentationLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  if (getClientRoutePresentationMode(url) === "website") return null;
  return redirect(getPwaEntryRoute(request));
}

export function requirePwaPresentationLoader(args?: LoaderFunctionArgs) {
  if (getClientRoutePresentationMode(args?.request.url) === "pwa") return null;
  return redirect(WEBSITE_ENTRY_ROUTE);
}
