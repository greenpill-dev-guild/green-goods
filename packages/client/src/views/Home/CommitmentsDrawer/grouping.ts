import type { CommitmentPoolRecord, Garden, InboxCommitment } from "@green-goods/shared";

export interface GardenGroup {
  key: string;
  gardenName: string;
  rows: InboxCommitment[];
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
    const key = garden?.address ?? "__unplaced__";
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
