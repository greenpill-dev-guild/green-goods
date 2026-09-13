import type { QueryKey } from "@tanstack/react-query";
import type { GardenVisit } from "./policy";

export type PreparationState = "unavailable" | "partial" | "ready" | "preparing";
interface PreparedGarden {
  address: string;
  chainId: number;
  account: string;
  state: PreparationState;
  updatedAt?: number;
  visitedAt: number;
  priority: number;
  workIds: string[];
  requestedLimit: number;
  truncated: boolean;
  queries: string[];
  assets: string[];
  failures: number;
}
interface PreparedAsset {
  url: string;
  bytes: number;
  accessedAt: number;
  owners: string[];
  protected: boolean;
  intent: "display" | "original";
}
interface PreparedQuery {
  contentHash: string;
  key: QueryKey;
  bytes: number;
  owners: string[];
  protected: boolean;
}
export interface DownloadManifest {
  version: 1;
  gardens: Record<string, PreparedGarden>;
  assets: Record<string, PreparedAsset>;
  queries: Record<string, PreparedQuery>;
  visits: GardenVisit[];
  storageFailure: boolean;
  essentialReady: boolean;
  essentialFailures?: number;
  essentialUpdatedAt?: number;
  essentialAssets?: string[];
  essentialQueries?: string[];
  activeScope?: string;
}
export function gardenPreparationKey(address: string, chainId: number, account: string): string {
  return `${chainId}:${account.toLowerCase()}:${address.toLowerCase()}`;
}
export function emptyDownloadManifest(): DownloadManifest {
  return {
    version: 1,
    gardens: {},
    assets: {},
    queries: {},
    visits: [],
    storageFailure: false,
    essentialReady: false,
  };
}
