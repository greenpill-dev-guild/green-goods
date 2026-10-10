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
 * The gardens an account reports to, as the indexer shows them. A read that failed is its own
 * answer: it is never an account with no gardens.
 */
export type GardenMemberships =
  | { ok: true; gardens: readonly ReportingGarden[] }
  | { ok: false; reason: "unavailable" };

/**
 * The gardens that accept chat reports on the Agent's chain, held as a snapshot: readers see the
 * last good list, and the worker refreshes it each pass.
 */
export interface GardenDirectory {
  list(): readonly ReportingGarden[];
  /**
   * The listed gardens whose gardener, operator or owner the indexer says this account is. It
   * decides which gardens a linked chat is offered, and nothing more: the account's role is read
   * from the chain before publishing. A garden the last good read placed the account in still
   * counts while the indexer is down; an account that read placed nowhere is `unavailable` until
   * a read succeeds again.
   */
  membershipsOf(account: Address): GardenMemberships;
  /**
   * Reloads the list once it is older than `maxAgeMs`, or than the directory's own lifetime when
   * that is left out. A failure keeps the previous list and rejects. A failed read is then left
   * alone for `retryAfterMs`, or for the directory's own wait when that is left out, so a turn
   * does not hold every chat up asking an indexer that is down.
   */
  refresh(nowMs: number, maxAgeMs?: number, retryAfterMs?: number): Promise<void>;
}

/**
 * What a chat chooses a report's garden from. A chat with no account sees every garden that
 * accepts reports. A linked one sees only the gardens its account reports to, and when those
 * cannot be read it is offered none rather than every garden.
 */
export type GardenScope =
  | { kind: "every"; gardens: readonly ReportingGarden[] }
  | { kind: "own"; gardens: readonly ReportingGarden[] }
  | { kind: "unavailable" };

export function gardenScope(directory: GardenDirectory, account: Address | null): GardenScope {
  if (!account) return { kind: "every", gardens: directory.list() };
  const memberships = directory.membershipsOf(account);
  return memberships.ok ? { kind: "own", gardens: memberships.gardens } : { kind: "unavailable" };
}

/** The gardens a scope lets a report name; none while they cannot be read. */
export function gardensIn(scope: GardenScope): readonly ReportingGarden[] {
  return scope.kind === "unavailable" ? [] : scope.gardens;
}

/** The garden a report takes without asking: the only one its chat could choose. */
export function soleGarden(scope: GardenScope): ReportingGarden | null {
  const gardens = gardensIn(scope);
  return gardens.length === 1 ? (gardens[0] as ReportingGarden) : null;
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
