import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";
import type { PassportPromiseRow } from "./data-public-passport-promises";
import { readPassportRows } from "./data-public-passport-reads";
import {
  type PassportMoneyLine,
  type PassportPaymentCounts,
  type PassportSettlement,
  PUBLIC_PASSPORT_MIN_PEOPLE,
} from "./public-passport-types";

type Outcome = keyof PassportPaymentCounts;

const OUTCOMES: readonly Outcome[] = ["confirmed", "sent", "queued", "failed", "cancelled"];

/**
 * Only an acknowledged arrival is money received. A queued payment has not been sent, a sent one
 * has not arrived, and a state this reader does not know fails the read instead of joining a
 * figure.
 */
function outcome(state: unknown): Outcome {
  switch (state) {
    case "CONFIRMED":
      return "confirmed";
    case "DISPATCHED":
      return "sent";
    case "QUEUED":
      return "queued";
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
  const payments: PassportPaymentCounts = {
    confirmed: 0,
    sent: 0,
    queued: 0,
    failed: 0,
    cancelled: 0,
  };
  const lines = new Map<Address, PassportMoneyLine>();
  // Distinct recipients behind each amount, read to apply the people floor and never published.
  const recipients = new Map<string, Set<string>>();
  for (const row of rows) {
    const token = tokenOf(row);
    const line = lines.get(token) ?? {
      token,
      confirmed: 0n,
      sent: 0n,
      queued: 0n,
      failed: 0n,
      cancelled: 0n,
    };
    lines.set(token, line);
    const result = outcome(row.state);
    payments[result] += 1;
    line[result] += integer(row.amount);
    const cell = `${token}:${result}`;
    const people = recipients.get(cell) ?? new Set<string>();
    recipients.set(cell, people);
    if (typeof row.recipient === "string") people.add(row.recipient.toLowerCase());
  }
  const sorted = [...lines.values()].sort((left, right) => left.token.localeCompare(right.token));
  return {
    payments,
    lines: sorted,
    /** The fewest people behind any one amount. No amounts at all clears every floor. */
    fewestPeopleBehindAnAmount: Math.min(
      ...sorted.flatMap((line) =>
        OUTCOMES.filter((result) => line[result] > 0n).map(
          (result) => recipients.get(`${line.token}:${result}`)?.size ?? 0
        )
      )
    ),
  };
}

/**
 * The garden's settlement reconciliation: what its payment plans declare beside what was queued,
 * sent, acknowledged, failed or cancelled. Payments that followed a registered rehearsal stay
 * out. Money sent to the garden itself names no promise, so it cannot be tied to a rehearsal.
 */
export async function readPassportSettlement(
  chainId: number,
  garden: Address,
  promises: readonly PassportPromiseRow[],
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
    // Plans that pay this garden's members. A plan that pays a beneficiary garden is not one.
    readPassportRows(
      reader,
      "CommitmentPayoutPlan",
      "id commitmentId token declaredAmount gardenRetainedAmount beneficiaryAmount finalized latestEditReasonCID updatedAt",
      "chainId: { _eq: $chainId }, providerGarden: { _eq: $garden }, payoutKind: { _eq: CONTRIBUTOR_CONSIDERATION }",
      scope,
      declarations
    ),
  ]).then((sets) => sets.map((rows) => rows.filter(counted)));

  const toGarden = tally(payments.filter((row) => row.kind !== "CONTRIBUTOR_CONSIDERATION"));
  const toMemberRows = payments.filter((row) => row.kind === "CONTRIBUTOR_CONSIDERATION");
  const toMembers = tally(toMemberRows);
  const people = new Set<string>();
  for (const row of toMemberRows) {
    if (typeof row.recipient === "string") people.add(row.recipient.toLowerCase());
  }
  // A plan with no payment yet still declares what named members are due, so it waits too.
  const withheld =
    (toMemberRows.length > 0 || plans.length > 0) && people.size < PUBLIC_PASSPORT_MIN_PEOPLE;

  const declared = new Map<Address, bigint>();
  for (const plan of plans) {
    const token = tokenOf(plan);
    // A plan's declared amount is what the garden keeps, what a beneficiary garden gets and
    // what its members get. Only the members' part is declared for them.
    const others = integer(plan.gardenRetainedAmount) + integer(plan.beneficiaryAmount);
    const forMembers = integer(plan.declaredAmount) - others;
    declared.set(token, (declared.get(token) ?? 0n) + (forMembers > 0n ? forMembers : 0n));
  }
  const changed = [...payments, ...plans].flatMap((row) =>
    typeof row.updatedAt === "number" ? [row.updatedAt] : []
  );
  return {
    asOf: changed.length === 0 ? null : Math.max(...changed),
    settlement: {
      keptAwaitingPaymentPlan: promises.filter(
        (row) => row.kept && row.declaresPayment && !row.hasPaymentPlan
      ).length,
      support: { payments: toGarden.payments, lines: toGarden.lines },
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
            payments: toMembers.payments,
            // Three people overall is not three people behind each amount: a single failed
            // payment would publish one member's pay. Amounts wait until every one clears it.
            lines:
              toMembers.fewestPeopleBehindAnAmount >= PUBLIC_PASSPORT_MIN_PEOPLE
                ? toMembers.lines
                : null,
          },
    },
  };
}
