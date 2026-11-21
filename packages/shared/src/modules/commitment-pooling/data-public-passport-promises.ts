import {
  publicRehearsalCommitments,
  publicRehearsalCycles,
} from "../../config/public-record-visibility";
import type { GraphQLReader } from "../data/graphql-client";
import { readPassportRows, readPassportRowsIn } from "./data-public-passport-reads";
import { integer, type RawRow } from "./data-core";
import {
  PUBLIC_PROMISE_KEPT_MIN_DISTINCT_PROVIDERS,
  selectPublicPromiseKeptRate,
} from "./disclosure";
import type { PassportPromises, PassportUnitLine } from "./public-passport-types";

const PROMISE_FIELDS = /* GraphQL */ `
  id commitmentId poolId cycleId direction state acceptanceSeen countedLifecycleStates unitLabel
  targetUnits approvedUnits leadProvider creator dueDate confirmationPath considerationRail
  payoutPlanId createdAt updatedAt
`;

/** One promise as the passport reads it. Identities stay inside this module's counts. */
export interface PassportPromiseRow {
  id: string;
  commitmentId: bigint;
  direction: string;
  state: string;
  takenUp: boolean;
  kept: boolean;
  unitLabel: string | null;
  targetUnits: bigint;
  approvedUnits: bigint;
  /** Lower case. Read to count distinct people, never published. */
  provider: string | null;
  dueDate: bigint;
  confirmationPath: string | null;
  /** The promise declares a G$ payment to its members, settled on Celo. */
  declaresPayment: boolean;
  hasPaymentPlan: boolean;
  createdAt: number | null;
  updatedAt: number;
}

function mapPromiseRow(row: RawRow): PassportPromiseRow {
  const counted = Array.isArray(row.countedLifecycleStates) ? row.countedLifecycleStates : [];
  const provider = row.leadProvider ?? (row.direction === "OFFER" ? row.creator : null);
  if (typeof row.updatedAt !== "number") throw new Error("Passport promise has no change time");
  return {
    id: String(row.id),
    commitmentId: integer(row.commitmentId),
    direction: String(row.direction),
    state: String(row.state),
    takenUp: row.acceptanceSeen === true,
    kept: row.state === "FULFILLED" || counted.includes("FULFILLED"),
    unitLabel: typeof row.unitLabel === "string" && row.unitLabel !== "" ? row.unitLabel : null,
    targetUnits: integer(row.targetUnits),
    approvedUnits: integer(row.approvedUnits),
    provider: typeof provider === "string" ? provider.toLowerCase() : null,
    dueDate: integer(row.dueDate),
    confirmationPath: typeof row.confirmationPath === "string" ? row.confirmationPath : null,
    declaresPayment: row.considerationRail === "CELO_SETTLEMENT",
    hasPaymentPlan: integer(row.payoutPlanId) > 0n,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : null,
    updatedAt: row.updatedAt,
  };
}

/** Whether review registered this promise as a rehearsal, by its cycle or by its own id. */
export function isRegisteredRehearsal(chainId: number, row: RawRow): boolean {
  const poolId = integer(row.poolId);
  if (
    publicRehearsalCommitments(chainId, poolId).some(
      (entry) => entry.commitmentId === integer(row.commitmentId)
    )
  ) {
    return true;
  }
  return (
    row.cycleId !== null &&
    row.cycleId !== undefined &&
    publicRehearsalCycles(chainId, poolId).some((cycle) => cycle.cycleId === integer(row.cycleId))
  );
}

/**
 * Every promise in the garden's pool, with registered rehearsals set apart: their promises stay
 * out of every figure, and their ids let later reads leave out what followed them.
 */
export async function readPassportPromiseRows(
  chainId: number,
  poolId: bigint,
  reader: GraphQLReader
): Promise<{ rows: PassportPromiseRow[]; rehearsalIds: Set<bigint> }> {
  const indexed = await readPassportRows(
    reader,
    "Commitment",
    PROMISE_FIELDS,
    "chainId: { _eq: $chainId }, poolId: { _eq: $poolId }, creationSeen: { _eq: true }",
    { chainId, poolId: poolId.toString() },
    "$chainId: Int!, $poolId: numeric!"
  );
  const rows: PassportPromiseRow[] = [];
  const rehearsalIds = new Set<bigint>();
  for (const row of indexed) {
    if (isRegisteredRehearsal(chainId, row)) rehearsalIds.add(integer(row.commitmentId));
    else rows.push(mapPromiseRow(row));
  }
  return { rows, rehearsalIds };
}

/**
 * The promises a garden's records name outside its own pool: a garden can provide for a promise
 * made in another pool. A rehearsal registered there stays out as it does at home, so the ids are
 * read and checked, and the rest come back for what else the caller needs of them.
 */
export async function readPromisesElsewhere(
  chainId: number,
  commitmentIds: readonly bigint[],
  promises: readonly PassportPromiseRow[],
  rehearsalIds: ReadonlySet<bigint>,
  reader: GraphQLReader
): Promise<{ rehearsals: Set<bigint>; elsewhere: RawRow[] }> {
  const known = new Set(promises.map((row) => row.commitmentId));
  const rehearsals = new Set(rehearsalIds);
  const ids = [...new Set(commitmentIds)].filter((id) => !known.has(id) && !rehearsals.has(id));
  const rows =
    ids.length === 0
      ? []
      : await readPassportRowsIn(reader, "Commitment", "id commitmentId poolId cycleId unitLabel", {
          chainId,
          field: "commitmentId",
          values: ids,
          extra: "creationSeen: { _eq: true }",
        });
  const elsewhere: RawRow[] = [];
  for (const row of rows) {
    if (isRegisteredRehearsal(chainId, row)) rehearsals.add(integer(row.commitmentId));
    else elsewhere.push(row);
  }
  return { rehearsals, elsewhere };
}

/** An offer nobody has taken up and whose term has not ended. */
export function isStandingOffer(row: PassportPromiseRow, now: number): boolean {
  return (
    row.direction === "OFFER" &&
    row.state === "OFFERED" &&
    (row.dueDate === 0n || row.dueDate > BigInt(now))
  );
}

const isReleased = (row: PassportPromiseRow) => row.takenUp && row.state === "CANCELLED";
const isDue = (row: PassportPromiseRow) => row.takenUp && !isReleased(row);
const isNotKept = (row: PassportPromiseRow) => isDue(row) && !row.kept && row.state === "EXPIRED";

/** Approved units never exceed the promise, and a kept promise counts in full. */
function deliveredUnits(row: PassportPromiseRow): bigint {
  if (row.kept) return row.targetUnits;
  return row.approvedUnits > row.targetUnits ? row.targetUnits : row.approvedUnits;
}

export function summarizePassportPromises(
  rows: readonly PassportPromiseRow[],
  now: number
): { promises: PassportPromises; asOf: number | null } {
  const due = rows.filter(isDue);
  const kept = due.filter((row) => row.kept);
  const unresolved = due.filter((row) => !row.kept);
  // Only people who stand behind a promise that is due count toward the floor. Someone with an
  // offer nobody took up adds no cover to another person's lapsed promise.
  const providers = new Set<string>();
  for (const row of due) {
    if (row.provider) providers.add(row.provider);
  }
  // The garden page publishes a kept rate under this same floor.
  const floorMet =
    selectPublicPromiseKeptRate({
      commitmentsFulfilled: BigInt(kept.length),
      commitmentsDue: BigInt(due.length),
      distinctProviderCount: BigInt(providers.size),
    }).kind === "rate";
  // The split says which promises lapsed, and units are listed apart, so what one unit's split
  // leaves out can be read off the totals. It is published for every unit that has something
  // unresolved, or for none: each of those units needs its own three people.
  const peopleByUnit = new Map<string, Set<string>>();
  for (const row of due) {
    if (!row.provider) continue;
    const unit = row.unitLabel ?? "";
    const people = peopleByUnit.get(unit) ?? new Set<string>();
    peopleByUnit.set(unit, people);
    people.add(row.provider);
  }
  const detailed =
    floorMet &&
    unresolved.every(
      (row) =>
        BigInt(peopleByUnit.get(row.unitLabel ?? "")?.size ?? 0) >=
        PUBLIC_PROMISE_KEPT_MIN_DISTINCT_PROVIDERS
    );

  const units = new Map<string, PassportUnitLine>();
  const line = (label: string) => {
    let entry = units.get(label);
    if (!entry) {
      entry = {
        unitLabel: label,
        promised: 0n,
        delivered: 0n,
        undelivered: 0n,
        stillToDeliver: detailed ? 0n : null,
        notDelivered: detailed ? 0n : null,
        onOffer: 0n,
      };
      units.set(label, entry);
    }
    return entry;
  };
  for (const row of rows) {
    if (!row.unitLabel) continue;
    if (isStandingOffer(row, now)) line(row.unitLabel).onOffer += row.targetUnits;
    if (!isDue(row)) continue;
    const entry = line(row.unitLabel);
    const delivered = deliveredUnits(row);
    const undelivered = row.targetUnits - delivered;
    entry.promised += row.targetUnits;
    entry.delivered += delivered;
    entry.undelivered += undelivered;
    if (entry.stillToDeliver !== null && entry.notDelivered !== null) {
      if (isNotKept(row)) entry.notDelivered += undelivered;
      else entry.stillToDeliver += undelivered;
    }
  }

  const created = rows.flatMap((row) => (row.createdAt === null ? [] : [row.createdAt]));
  return {
    asOf: rows.length === 0 ? null : Math.max(...rows.map((row) => row.updatedAt)),
    promises: {
      since: created.length === 0 ? null : Math.min(...created),
      made: rows.length,
      takenUp: rows.filter((row) => row.takenUp).length,
      due: due.length,
      kept: kept.length,
      unresolved: unresolved.length,
      breakdown: detailed
        ? {
            stillOpen: unresolved.filter((row) => !isNotKept(row)).length,
            awaitingConfirmation: unresolved.filter((row) => row.state === "READY_FOR_CONFIRMATION")
              .length,
            notKept: unresolved.filter(isNotKept).length,
            pastDue: unresolved.filter(
              (row) => !isNotKept(row) && row.dueDate !== 0n && row.dueDate <= BigInt(now)
            ).length,
            partlyDelivered: unresolved.filter((row) => {
              const delivered = deliveredUnits(row);
              return delivered > 0n && delivered < row.targetUnits;
            }).length,
          }
        : null,
      standingOffers: rows.filter((row) => isStandingOffer(row, now)).length,
      units: [...units.values()].sort((left, right) =>
        left.unitLabel.localeCompare(right.unitLabel)
      ),
    },
  };
}
