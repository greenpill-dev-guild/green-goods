import type { Enum } from "envio";

type Domain = Enum<"Domain">;

export type GardenDomainsEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly domainMask: number;
  readonly domains: Domain[];
  readonly updatedAt: number;
};

export type TransactionWithHash = { hash: string };

export interface FetchJsonContext {
  eventType: string;
  chainId: number;
  blockNumber: number;
  txHash: string;
  log: { warn: (message: string, context?: Record<string, unknown>) => void };
}
