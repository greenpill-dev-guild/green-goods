import type { Address } from "@green-goods/shared/types/domain";

/**
 * A garden that accepts chat reports. `key` is its stable identifier in chat choices, model output
 * and review references (the live directory uses the lowercase address); `label` is the garden's
 * steward-editable name, for display only.
 */
export interface ReportingGarden {
  key: string;
  chainId: number;
  address: `0x${string}`;
  label: string;
}

/**
 * The gardens that accept chat reports on the Agent's chain, held as a snapshot so a turn never
 * waits on the indexer: readers see the last good list, and the worker refreshes it each pass.
 */
export interface GardenDirectory {
  list(): readonly ReportingGarden[];
  /**
   * The listed gardens whose gardener, operator or owner the indexer says this account is. It only
   * orders and names choices in chat: the account's role is read from the chain before publishing.
   */
  gardensOf(account: Address): readonly ReportingGarden[];
  /** Reloads the list once it is stale; a failure keeps the previous list and rejects. */
  refresh(nowMs: number): Promise<void>;
}

export function findGarden(
  gardens: GardenDirectory,
  address: string | null | undefined
): ReportingGarden | null {
  const wanted = address?.toLowerCase();
  return wanted ? (gardens.list().find((garden) => garden.address === wanted) ?? null) : null;
}

export function gardenByKey(gardens: GardenDirectory, key: string): ReportingGarden | null {
  return gardens.list().find((garden) => garden.key === key) ?? null;
}
