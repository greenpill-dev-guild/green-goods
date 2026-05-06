import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";

const DEFAULT_CLIENT_APP_URL = "https://greengoods.app";

function normalizeClientBaseUrl(baseUrl?: string): string {
  return (baseUrl || DEFAULT_CLIENT_APP_URL).replace(/\/+$/, "");
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
  pathSuffix = ""
): string {
  const baseUrl = normalizeClientBaseUrl(clientBaseUrl);
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
