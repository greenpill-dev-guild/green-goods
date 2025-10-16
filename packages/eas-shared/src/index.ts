import { Client, cacheExchange, fetchExchange, type Exchange } from "@urql/core";

export interface CreateEasClientOptions {
  chainId?: number | string;
  url?: string;
  resolveUrl?: (chainId?: number | string) => string;
  exchanges?: Exchange[];
}

const defaultExchanges = [cacheExchange, fetchExchange];

export function createEasClient({
  chainId,
  url,
  resolveUrl,
  exchanges = defaultExchanges,
}: CreateEasClientOptions = {}) {
  const resolvedUrl = url ?? resolveUrl?.(chainId);

  if (!resolvedUrl) {
    throw new Error(
      "createEasClient requires either a url option or a resolveUrl(chainId) helper"
    );
  }

  return new Client({
    url: resolvedUrl,
    exchanges,
  });
}

export function withEasUrlResolver(
  resolveUrl: (chainId?: number | string) => string
): (options?: Omit<CreateEasClientOptions, "resolveUrl" | "url">) => Client {
  return (options = {}) => createEasClient({ ...options, resolveUrl });
}
