import { publicRehearsalCycles } from "../../config/public-record-visibility";
import type { GraphQLReader } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";
import { selectPublicPromiseKeptRate } from "./disclosure";
import type { PassportPromises, PassportUnitLine } from "./public-passport-types";

const PAGE_SIZE = 100;
/** A pool past this many promises needs a paged passport, not a longer wait. */
const PROMISE_ROW_LIMIT = 2000;

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

/**
 * Keyset pages over one indexed entity. A read that cannot finish inside its limit fails, because
 * a passport figure computed from part of a record would be published as the whole.
 */
export async function readPassportRows(
  reader: GraphQLReader,
  entity: string,
  fields: string,
  where: string,
  variables: Record<string, unknown>,
  declarations: string,
  limit = PROMISE_ROW_LIMIT
): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  const deadline = AbortSignal.timeout(30000);
  let after = "";
  while (true) {
    deadline.throwIfAborted();
    const result = await reader.query<Record<string, RawRow[]>>(
      `query PublicPassport${entity}(${declarations}, $after: String!) {
        ${entity}(where: { ${where}, id: { _gt: $after } }, order_by: { id: asc }, limit: ${PAGE_SIZE}) { ${fields} }
      }`,
      { ...variables, after },
      `getPublicPassport${entity}`
    );
    if (result.error) throw result.error;
    const page = result.data?.[entity];
    if (!Array.isArray(page)) throw new Error(`Passport ${entity} records are unavailable`);
    for (const row of page) {
      if (typeof row.id !== "string" || row.id <= after) {
        throw new Error(`Passport ${entity} records did not advance`);
      }
      after = row.id;
      rows.push(row);
    }
    if (rows.length > limit) throw new Error(`Passport ${entity} history exceeds its read limit`);
    if (page.length < PAGE_SIZE) return rows;
  }
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

/**
 * Every promise in the garden's pool, with registered rehearsals set apart: their promises stay
 * out of every figure, and their ids let later reads leave out the money that followed them.
 */
export async function readPassportPromiseRows(
  chainId: number,
  poolId: bigint,
  reader: GraphQLReader
): Promise<{ rows: PassportPromiseRow[]; rehearsalIds: Set<bigint> }> {
  const rehearsals = publicRehearsalCycles(chainId, poolId);
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
    const rehearsal =
      row.cycleId !== null &&
      row.cycleId !== undefined &&
      rehearsals.some((cycle) => cycle.cycleId === integer(row.cycleId));
    if (rehearsal) rehearsalIds.add(integer(row.commitmentId));
    else rows.push(mapPromiseRow(row));
  }
  return { rows, rehearsalIds };
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
  const providers = new Set<string>();
  for (const row of rows) {
    if ((row.takenUp || row.direction === "OFFER") && row.provider) providers.add(row.provider);
  }
  // The garden page publishes a kept rate under this same floor.
  const detailed =
    selectPublicPromiseKeptRate({
      commitmentsFulfilled: BigInt(kept.length),
      commitmentsDue: BigInt(due.length),
      distinctProviderCount: BigInt(providers.size),
    }).kind === "rate";

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
