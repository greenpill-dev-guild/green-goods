import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import { getCampaignCookieJarCampaigns } from "../../modules/data/campaign-cookie-jars";
import type { CampaignCookieJarCampaign } from "../../types/cookie-jar";
import { parseCampaignCookieJarFallbacks } from "../../utils/cookie-jar-campaign";
import { useCurrentChain } from "../blockchain/useChainConfig";

interface CampaignCookieJarCampaignsOptions {
  enabled?: boolean;
}

interface CampaignCookieJarCampaignsResult {
  campaigns: CampaignCookieJarCampaign[];
  indexedCampaigns: CampaignCookieJarCampaign[];
  fallbackCampaigns: CampaignCookieJarCampaign[];
  isLoading: boolean;
  isFallback: boolean;
  error: Error | null;
}

function getCampaignJarFallbackEnv(): {
  raw?: string;
  enabled: boolean;
} {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta.env as {
          DEV?: boolean;
          MODE?: string;
          STORYBOOK?: boolean | string;
          VITE_STORYBOOK?: boolean | string;
          VITE_CAMPAIGN_COOKIE_JARS?: string;
        })
      : {};

  return {
    raw: env.VITE_CAMPAIGN_COOKIE_JARS,
    enabled:
      Boolean(env.DEV) ||
      env.MODE === "test" ||
      Boolean(env.STORYBOOK) ||
      Boolean(env.VITE_STORYBOOK),
  };
}

export function useCampaignCookieJarCampaigns(
  options: CampaignCookieJarCampaignsOptions = {}
): CampaignCookieJarCampaignsResult {
  const chainId = useCurrentChain();
  const fallbackEnv = getCampaignJarFallbackEnv();
  const fallbackCampaigns = useMemo(
    () => (fallbackEnv.enabled ? parseCampaignCookieJarFallbacks(fallbackEnv.raw) : []),
    [fallbackEnv.enabled, fallbackEnv.raw]
  );

  const query = useQuery({
    queryKey: queryKeys.cookieJar.campaigns(chainId),
    queryFn: () => getCampaignCookieJarCampaigns(chainId),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME_MEDIUM,
    retry: false,
  });

  const indexedCampaigns = query.data ?? [];
  const isFallback = fallbackCampaigns.length > 0 && indexedCampaigns.length === 0;

  return {
    campaigns: isFallback ? fallbackCampaigns : indexedCampaigns,
    indexedCampaigns,
    fallbackCampaigns,
    isLoading: query.isLoading && !isFallback,
    isFallback,
    error: query.error ?? null,
  };
}
