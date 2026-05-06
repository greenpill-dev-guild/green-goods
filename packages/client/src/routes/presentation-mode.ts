import { getClientPresentationMode } from "@green-goods/shared/utils";
import { redirect, type LoaderFunctionArgs } from "react-router-dom";

const PWA_ENTRY_ROUTE = "/home";
const WEBSITE_ENTRY_ROUTE = "/";

function getSafeInternalRedirect(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "https://greengoods.local");
    if (url.origin !== "https://greengoods.local") return null;
    if (url.pathname === WEBSITE_ENTRY_ROUTE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
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
  if (getClientPresentationMode(request.url) === "website") return null;
  return redirect(getPwaEntryRoute(request));
}

export function requirePwaPresentationLoader(args?: LoaderFunctionArgs) {
  if (getClientPresentationMode(args?.request.url) === "pwa") return null;
  return redirect(WEBSITE_ENTRY_ROUTE);
}
