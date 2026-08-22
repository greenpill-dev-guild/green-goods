import type { Address } from "@green-goods/shared";

export interface CommunityPoolsProps {
  chainId: number;
  garden: { id: Address; name: string };
  canManage: boolean;
}

/**
 * W12, Community → Pools: the protocol pool plus this garden's pool
 * (uiux-spec §6.8). Built in a later commit; the mode is mounted now.
 */
export function CommunityPools(_props: CommunityPoolsProps) {
  return null;
}
