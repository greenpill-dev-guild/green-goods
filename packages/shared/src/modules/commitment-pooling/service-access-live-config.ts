import type { Hex } from "viem";
import type { Address } from "../../types/domain";

export interface ServiceDeploymentPin {
  address: Address;
  owner: Address;
  receipt: { transactionHash: Hex; blockNumber: bigint; blockHash: Hex; kind?: "safe-upgrade" };
  runtimeCodeHash: Hex;
  implementation: { address: Address; runtimeCodeHash: Hex };
}

export interface ServiceLiveRoute {
  id: string;
  revision: number;
  sourceChainId: 42161;
  core: ServiceDeploymentPin;
  source: ServiceDeploymentPin & { guardian: Address; router: Address; remoteSelector: bigint };
  destination: ServiceDeploymentPin & {
    guardian: Address;
    router: Address;
    remoteSelector: bigint;
  };
  assets: readonly {
    token: Address;
    issuer: Address;
    symbol: string;
    decimals: number;
    runtimeCodeHash: Hex;
    implementation: { address: Address; runtimeCodeHash: Hex };
  }[];
  buyerGardens: readonly { address: Address; name: string }[];
}

/** Populate only from verified live deployment/adoption receipts; rehearsal addresses never belong here. */
export const SERVICE_LIVE_ROUTES: readonly ServiceLiveRoute[] = [];
