import {
  createPublicClient,
  fallback,
  http,
  HttpRequestError,
  TimeoutError,
  type Chain,
} from "viem";
import { createViemProfileAvatarSignatureVerifier } from "./profile-avatars";

/** Keep contract-account verification inside the join route's pre-write budget. */
export function createGardenJoinRequestSignatureVerifier(options: {
  chain: Chain;
  rpcUrl: string;
}) {
  const primary = new URL(options.rpcUrl);
  const isLocal =
    ["localhost", "[::1]"].includes(primary.hostname) || primary.hostname.startsWith("127.");
  const publicRpc = options.chain.rpcUrls.default.http[0];
  const urls =
    !isLocal && publicRpc && new URL(publicRpc).href !== primary.href
      ? [options.rpcUrl, publicRpc]
      : [options.rpcUrl];
  const client = createPublicClient({
    chain: options.chain,
    transport: fallback(
      urls.map((url) => http(url, { timeout: 1_500, retryCount: 0 })),
      {
        retryCount: 0,
        shouldThrow: (error) =>
          !(error instanceof HttpRequestError || error instanceof TimeoutError),
      }
    ),
  });
  const verify = createViemProfileAvatarSignatureVerifier({ ...options, client });
  return (input: Parameters<typeof verify>[0]) =>
    input.chainId === options.chain.id ? verify(input) : Promise.resolve(false);
}
