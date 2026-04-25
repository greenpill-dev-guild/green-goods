import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";

const DEFAULT_CLIENT_APP_URL = "https://greengoods.app";

function normalizeClientBaseUrl(baseUrl?: string): string {
  return (baseUrl || DEFAULT_CLIENT_APP_URL).replace(/\/+$/, "");
}

export function buildClientGardenRedirectUrl(
  gardenId?: string,
  locationSearch = "",
  locationHash = "",
  clientBaseUrl = import.meta.env.VITE_CLIENT_APP_URL
): string {
  const baseUrl = normalizeClientBaseUrl(clientBaseUrl);
  const gardenPath = gardenId ? `/gardens/${encodeURIComponent(gardenId)}` : "/gardens";
  return `${baseUrl}${gardenPath}${locationSearch}${locationHash}`;
}

export default function PublicGardenRedirect() {
  const { gardenId } = useParams<{ gardenId?: string }>();
  const location = useLocation();
  const redirectUrl = buildClientGardenRedirectUrl(gardenId, location.search, location.hash);

  useEffect(() => {
    window.location.replace(redirectUrl);
  }, [redirectUrl]);

  return null;
}
