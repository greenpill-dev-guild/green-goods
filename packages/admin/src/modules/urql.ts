import { createEasClient as baseCreateEasClient } from "@green-goods/eas-shared";

import { getEasGraphqlUrl } from "@/config";

export function createEasClient(chainId?: number | string) {
  return baseCreateEasClient({ chainId, resolveUrl: getEasGraphqlUrl });
}
