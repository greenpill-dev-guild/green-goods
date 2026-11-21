import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";
import { readPassportRows } from "./data-public-passport-promises";
import {
  type PassportMoneyLine,
  type PassportSettlement,
  PUBLIC_PASSPORT_MIN_PEOPLE,
} from "./public-passport-types";

type Outcome = "confirmed" | "awaiting" | "failed" | "cancelled";

/**
 * Only an acknowledged arrival is money received. A queued or sent payment is still awaited, and
 * a state this reader does not know fails the read instead of joining a figure.
 */
function outcome(state: unknown): Outcome {
  switch (state) {
    case "CONFIRMED":
      return "confirmed";
    case "QUEUED":
    case "DISPATCHED":
      return "awaiting";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      throw new Error("Passport payment has an unknown state");
  }
}

function tokenOf(row: RawRow): Address {
  if (typeof row.token !== "string" || !/^0x[0-9a-f]{40}$/i.test(row.token)) {
    throw new Error("Passport payment has no token");
  }
  return row.token.toLowerCase() as Address;
}

function tally(rows: readonly RawRow[]) {
  const payments = { confirmed: 0, awaiting: 0, failed: 0, cancelled: 0 };
  const lines = new Map<Address, PassportMoneyLine>();
  for (const row of rows) {
    const token = tokenOf(row);
    const line = lines.get(token) ?? {
      token,
      confirmed: 0n,
      awaiting: 0n,
      failed: 0n,
      cancelled: 0n,
    };
    lines.set(token, line);
    const result = outcome(row.state);
    payments[result] += 1;
    line[result] += integer(row.amount);
  }
  return {
    payments,
    lines: [...lines.values()].sort((left, right) => left.token.localeCompare(right.token)),
  };
}

/**
 * The garden's settlement reconciliation: what its payment plans declare beside what was sent,
 * acknowledged, failed or cancelled. Payments that followed a registered rehearsal stay out.
 */
export async function readPassportSettlement(
  chainId: number,
  garden: Address,
  rehearsalIds: ReadonlySet<bigint>,
  reader: GraphQLReader
): Promise<{ settlement: PassportSettlement; asOf: number | null }> {
  const scope = { chainId, garden: garden.toLowerCase() };
  const declarations = "$chainId: Int!, $garden: String!";
  const counted = (row: RawRow) =>
    row.commitmentId === null ||
    row.commitmentId === undefined ||
    !rehearsalIds.has(integer(row.commitmentId));
  const [payments, plans] = await Promise.all([
    readPassportRows(
      reader,
      "Disbursement",
      "id kind state token amount recipient commitmentId updatedAt",
      "chainId: { _eq: $chainId }, garden: { _eq: $garden }, kind: { _in: [FUNDING, GARDEN_BENEFICIARY, CONTRIBUTOR_CONSIDERATION] }",
      scope,
      declarations
    ),
    readPassportRows(
      reader,
      "CommitmentPayoutPlan",
      "id commitmentId token declaredAmount finalized latestEditReasonCID updatedAt",
      "chainId: { _eq: $chainId }, providerGarden: { _eq: $garden }",
      scope,
      declarations
    ),
  ]).then((sets) => sets.map((rows) => rows.filter(counted)));

  const toMembers = payments.filter((row) => row.kind === "CONTRIBUTOR_CONSIDERATION");
  const toGarden = payments.filter((row) => row.kind !== "CONTRIBUTOR_CONSIDERATION");
  const people = new Set<string>();
  for (const row of toMembers) {
    if (typeof row.recipient === "string") people.add(row.recipient.toLowerCase());
  }
  // A plan with no payment yet still declares what named members are due, so it waits too.
  const withheld =
    (toMembers.length > 0 || plans.length > 0) && people.size < PUBLIC_PASSPORT_MIN_PEOPLE;

  const declared = new Map<Address, bigint>();
  for (const plan of plans) {
    const token = tokenOf(plan);
    declared.set(token, (declared.get(token) ?? 0n) + integer(plan.declaredAmount));
  }
  const changed = [...payments, ...plans].flatMap((row) =>
    typeof row.updatedAt === "number" ? [row.updatedAt] : []
  );
  return {
    asOf: changed.length === 0 ? null : Math.max(...changed),
    settlement: {
      support: tally(toGarden),
      memberPayments: withheld
        ? { withheld: true }
        : {
            withheld: false,
            plans: plans.length,
            plansFinalized: plans.filter((plan) => plan.finalized === true).length,
            plansRevised: plans.filter(
              (plan) => typeof plan.latestEditReasonCID === "string" && plan.latestEditReasonCID
            ).length,
            declared: [...declared.entries()]
              .map(([token, amount]) => ({ token, amount }))
              .sort((left, right) => left.token.localeCompare(right.token)),
            ...tally(toMembers),
          },
    },
  };
}
