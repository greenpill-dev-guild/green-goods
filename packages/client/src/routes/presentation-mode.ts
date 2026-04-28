import { getClientPresentationMode } from "@green-goods/shared/utils";
import { redirect, type LoaderFunctionArgs } from "react-router-dom";

const PWA_ENTRY_ROUTE = "/home";
const WEBSITE_ENTRY_ROUTE = "/";

function getPwaEntryRoute(request: Request): string {
  const url = new URL(request.url);
  if (url.pathname !== WEBSITE_ENTRY_ROUTE) return PWA_ENTRY_ROUTE;
  return url.searchParams.get("redirectTo") || PWA_ENTRY_ROUTE;
}

export function requireWebsitePresentationLoader({ request }: LoaderFunctionArgs) {
  if (getClientPresentationMode() === "website") return null;
  return redirect(getPwaEntryRoute(request));
}

export function requirePwaPresentationLoader(_args?: LoaderFunctionArgs) {
  if (getClientPresentationMode() === "pwa") return null;
  return redirect(WEBSITE_ENTRY_ROUTE);
}
