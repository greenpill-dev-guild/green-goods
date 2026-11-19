import type { Address, Garden } from "@green-goods/shared/types/domain";
import type {
  CommitmentMetadataV1,
  CommitmentPoolRecord,
  CommitmentsToConfirm,
  InboxCommitment,
  ServiceAccessKey,
} from "@green-goods/shared/commitment-pooling";
import { identicalOpenCopyKey } from "@green-goods/shared/modules/commitment-pooling/display-groups";

/**
 * What the To confirm tab lists, and so what its badge and the launcher count:
 * the confirmations its gardens make as the party. The reasoned fallbacks and
 * disputes that `count` adds are the Hub's queue, which this tab does not list.
 */
export function listedToConfirmCount(toConfirm: Pick<CommitmentsToConfirm, "groups">): number {
  return toConfirm.groups.reduce((sum, group) => sum + group.rows.length, 0);
}

export interface GardenGroup {
  key: string;
  gardenName: string;
  rows: InboxCommitment[];
}

/**
 * The rows that may be the reader's booking of a service, keyed as the promise page reads them:
 * an approval-gated offer one person takes up, made by someone else.
 */
export function bookingReadKeys(
  rows: readonly InboxCommitment[],
  scope: { viewer: Address | null; sourceChainId: number; coreModule: Address }
): ServiceAccessKey[] {
  const { viewer, sourceChainId, coreModule } = scope;
  if (!viewer) return [];
  const seen = new Set<string>();
  return rows.flatMap(({ commitment }) => {
    const id = commitment.commitmentId.toString();
    const booking =
      commitment.direction === "OFFER" &&
      commitment.claimMode === "APPROVAL_GATED" &&
      commitment.claimType === "INDIVIDUAL" &&
      commitment.creator?.toLowerCase() !== viewer.toLowerCase();
    if (!booking || seen.has(id)) return [];
    seen.add(id);
    return [{ sourceChainId, coreModule, commitmentId: commitment.commitmentId, buyer: viewer }];
  });
}

/**
 * The rows with each booking's own Needs you (its deposit, its split, a failed transfer) added to
 * what the promise's acts say, and what needs the reader first, so it leads the list and never
 * folds into identical copies.
 */
export function withBookingNeedsYou(
  rows: readonly InboxCommitment[],
  needs: ReadonlySet<string>
): InboxCommitment[] {
  const marked = rows.map((row) =>
    !row.needsYou && needs.has(row.commitment.commitmentId.toString())
      ? { ...row, needsYou: true }
      : row
  );
  return [...marked.filter((row) => row.needsYou), ...marked.filter((row) => !row.needsYou)];
}

/** One line of the Live list: a promise, or its identical open copies as one (DL-150). */
export type LiveEntry =
  | { kind: "row"; row: InboxCommitment }
  | { kind: "copies"; rows: InboxCommitment[] };

/**
 * Fold identical open copies into one entry that takes the place of its first copy. The display
 * groups judge what is identical; what waits on the reader, or says it didn't send, keeps its
 * own row here. Every copy stays its own promise.
 */
export function foldIdenticalCopies(
  rows: readonly InboxCommitment[],
  metadataByCID: ReadonlyMap<string, CommitmentMetadataV1>,
  sendFailed: ReadonlySet<string>
): LiveEntry[] {
  const copies = new Map<string, InboxCommitment[]>();
  const keys = rows.map((row) => {
    const key =
      row.needsYou || sendFailed.has(row.commitment.commitmentId.toString())
        ? null
        : identicalOpenCopyKey(row.commitment, metadataByCID);
    if (key) copies.set(key, [...(copies.get(key) ?? []), row]);
    return key;
  });
  return rows.flatMap((row, index): LiveEntry[] => {
    const key = keys[index];
    const fold = key ? copies.get(key) : undefined;
    if (!key || !fold || fold.length < 2) return [{ kind: "row", row }];
    return fold[0] === row ? [{ kind: "copies", rows: fold }] : [];
  });
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
