import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";

const DEFAULT_CLIENT_APP_URL = "https://greengoods.app";

/**
 * The client origin that pairs with an admin host, so a deployment sends people
 * to its own client rather than to production.
 *
 * `admin.greengoods.app` pairs with the apex, and every prefixed admin host
 * pairs with the matching client host — `beta-admin` with `beta`,
 * `staging-admin` with `staging`. Anything else (localhost, a preview URL) has
 * no derivable pair and returns undefined so the caller falls through.
 */
function clientOriginForAdminHost(hostname?: string): string | undefined {
  if (!hostname?.endsWith(".greengoods.app")) return undefined;
  if (hostname === "admin.greengoods.app") return DEFAULT_CLIENT_APP_URL;
  const prefixed = /^(.+)-admin\.greengoods\.app$/.exec(hostname);
  return prefixed ? `https://${prefixed[1]}.greengoods.app` : undefined;
}

function normalizeClientBaseUrl(baseUrl?: string, adminHostname?: string): string {
  const resolved = baseUrl || clientOriginForAdminHost(adminHostname) || DEFAULT_CLIENT_APP_URL;
  return resolved.replace(/\/+$/, "");
}

function encodePathSuffix(pathSuffix?: string): string {
  if (!pathSuffix) return "";
  return pathSuffix
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildClientGardenRedirectUrl(
  gardenId?: string,
  locationSearch = "",
  locationHash = "",
  clientBaseUrl = import.meta.env.VITE_CLIENT_APP_URL,
  pathSuffix = "",
  adminHostname = typeof window === "undefined" ? undefined : window.location.hostname
): string {
  const baseUrl = normalizeClientBaseUrl(clientBaseUrl, adminHostname);
  const nestedPath = encodePathSuffix(pathSuffix);
  const gardenPath = gardenId
    ? `/gardens/${encodeURIComponent(gardenId)}${nestedPath ? `/${nestedPath}` : ""}`
    : "/gardens";
  return `${baseUrl}${gardenPath}${locationSearch}${locationHash}`;
}

export default function PublicGardenRedirect() {
  const { gardenId, "*": pathSuffix } = useParams<{ gardenId?: string; "*": string }>();
  const location = useLocation();
  const redirectUrl = buildClientGardenRedirectUrl(
    gardenId,
    location.search,
    location.hash,
    undefined,
    pathSuffix
  );

  useEffect(() => {
    window.location.replace(redirectUrl);
  }, [redirectUrl]);

  return null;
}
