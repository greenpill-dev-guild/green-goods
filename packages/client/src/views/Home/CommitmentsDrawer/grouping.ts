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
  const gardenByPoolId = new Map(
    pools.map((pool) => [
      pool.poolId.toString(),
      pool.garden ? (gardenByAddress.get(pool.garden.toLowerCase()) ?? null) : null,
    ])
  );

  const groups = new Map<string, GardenGroup>();
  for (const row of rows) {
    const poolId = row.commitment.poolId?.toString();
    const gardenName = (poolId ? gardenByPoolId.get(poolId) : null) ?? null;
    const key = gardenName ?? "__unplaced__";
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
