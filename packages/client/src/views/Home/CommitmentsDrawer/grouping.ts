import type { Garden } from "@green-goods/shared";
import type { CommitmentPoolRecord, InboxCommitment } from "@green-goods/shared/commitment-pooling";

export interface GardenGroup {
  key: string;
  gardenName: string;
  rows: InboxCommitment[];
}

/**
 * The garden a row's commitment belongs to, by address, or null when its pool
 * is not in view yet. A row with no garden has no route to open, so it stays
 * a record: the name-less "Other" group may still hold openable rows, because
 * knowing a garden's address and knowing its name are different things.
 */
export function gardenAddressFor(
  row: InboxCommitment,
  pools: readonly CommitmentPoolRecord[]
): string | null {
  const poolId = row.commitment.poolId;
  if (poolId === null || poolId === undefined) return null;
  const pool = pools.find((candidate) => candidate.poolId === poolId);
  return pool?.garden ?? null;
}

/**
 * Group a member's commitments under the garden they belong to.
 *
 * A commitment names its pool, and a pool names its garden, so the two lookups
 * are chained rather than assumed. A commitment whose pool or garden has not
 * arrived yet is grouped under an explicit unplaced heading instead of being
 * dropped: losing a row silently is worse than showing it without a home.
 */
export function groupByGarden(
  rows: readonly InboxCommitment[],
  pools: readonly CommitmentPoolRecord[],
  gardens: readonly Garden[],
  unplacedLabel = "Other"
): GardenGroup[] {
  const gardenByAddress = new Map(gardens.map((garden) => [garden.id.toLowerCase(), garden.name]));
  // Keyed by the garden's address, not its name. Two gardens are allowed to
  // share a name, and grouping by it silently merges them into one heading.
  const gardenByPoolId = new Map(
    pools.map((pool) => {
      const address = pool.garden?.toLowerCase() ?? null;
      return [
        pool.poolId.toString(),
        address ? { address, name: gardenByAddress.get(address) ?? null } : null,
      ] as const;
    })
  );

  const groups = new Map<string, GardenGroup>();
  for (const row of rows) {
    const poolId = row.commitment.poolId?.toString();
    const garden = (poolId ? gardenByPoolId.get(poolId) : null) ?? null;
    const gardenName = garden?.name ?? null;
    // A group is identified by address so two gardens sharing a name stay
    // apart, but only once it HAS a name. A garden the member cannot see is
    // unnameable, and keying those by address produced one heading per garden
    // all reading "Other", sorted among the real ones instead of after them.
    const key = gardenName ? (garden?.address ?? "__unplaced__") : "__unplaced__";
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    groups.set(key, { key, gardenName: gardenName ?? unplacedLabel, rows: [row] });
  }

  // Named gardens first, alphabetically; anything unplaced sits at the end.
  return [...groups.values()].sort((left, right) => {
    if (left.key === "__unplaced__") return 1;
    if (right.key === "__unplaced__") return -1;
    return left.gardenName.localeCompare(right.gardenName);
  });
}
