import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";
import { type PassportPromiseRow, readPromisesElsewhere } from "./data-public-passport-promises";
import { readPassportRows, readPassportRowsIn } from "./data-public-passport-reads";
import {
  type PassportMoneyLine,
  type PassportPaymentCounts,
  type PassportSettlement,
  PUBLIC_PASSPORT_MIN_PEOPLE,
} from "./public-passport-types";

type Outcome = Exclude<keyof PassportPaymentCounts, "token">;

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

/**
 * The member a payment is for. A plan can send a member's payment to another address, so the
 * member is counted, not the address: two members must never count as four.
 */
function memberOf(row: RawRow): string | null {
  const member = typeof row.contributor === "string" ? row.contributor : row.recipient;
  return typeof member === "string" ? member.toLowerCase() : null;
}

function tally(rows: readonly RawRow[]) {
  const counts = new Map<Address, PassportPaymentCounts>();
  const lines = new Map<Address, PassportMoneyLine>();
  // Distinct recipients behind each amount, read to apply the people floor and never published.
  const recipients = new Map<string, Set<string>>();
  for (const row of rows) {
    const token = tokenOf(row);
    const count = counts.get(token) ?? {
      token,
      confirmed: 0,
      sent: 0,
      queued: 0,
      failed: 0,
      cancelled: 0,
    };
    counts.set(token, count);
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
    count[result] += 1;
    line[result] += integer(row.amount);
    const cell = `${token}:${result}`;
    const people = recipients.get(cell) ?? new Set<string>();
    recipients.set(cell, people);
    const member = memberOf(row);
    if (member) people.add(member);
  }
  const byToken = <T extends { token: Address }>(entries: Map<Address, T>) =>
    [...entries.values()].sort((left, right) => left.token.localeCompare(right.token));
  const sorted = byToken(lines);
  return {
    payments: byToken(counts),
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
 * out, in whichever pool the rehearsal was registered. Money sent to the garden itself names no
 * promise, so it cannot be tied to a rehearsal.
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
  const promiseOf = (row: RawRow) =>
    row.commitmentId === null || row.commitmentId === undefined ? [] : [integer(row.commitmentId)];
  const [payments, plans] = await Promise.all([
    readPassportRows(
      reader,
      "Disbursement",
      "id kind state token amount recipient contributor commitmentId updatedAt",
      "chainId: { _eq: $chainId }, garden: { _eq: $garden }, kind: { _in: [FUNDING, GARDEN_BENEFICIARY, CONTRIBUTOR_CONSIDERATION] }",
      scope,
      declarations
    ),
    // Plans that pay this garden's members. A plan that pays a beneficiary garden is not one.
    readPassportRows(
      reader,
      "CommitmentPayoutPlan",
      "id payoutPlanId commitmentId token finalized latestEditReasonCID updatedAt",
      "chainId: { _eq: $chainId }, providerGarden: { _eq: $garden }, payoutKind: { _eq: CONTRIBUTOR_CONSIDERATION }",
      scope,
      declarations
    ),
  ]).then(async (sets) => {
    const { rehearsals } = await readPromisesElsewhere(
      chainId,
      sets.flat().flatMap(promiseOf),
      promises,
      rehearsalIds,
      reader
    );
    return sets.map((rows) =>
      rows.filter((row) => !promiseOf(row).some((id) => rehearsals.has(id)))
    );
  });

  const toGarden = tally(payments.filter((row) => row.kind !== "CONTRIBUTOR_CONSIDERATION"));
  const toMemberRows = payments.filter((row) => row.kind === "CONTRIBUTOR_CONSIDERATION");
  const toMembers = tally(toMemberRows);

  // What each plan assigns to each member. Read to know how many members stand behind a declared
  // amount, and which of those amounts is not confirmed as paid yet. Never published by member.
  const assigned = (
    plans.length === 0
      ? []
      : await readPassportRowsIn(
          reader,
          "ContributorPayout",
          "id payoutPlanId contributor amount disbursementEntityId updatedAt",
          {
            chainId,
            field: "payoutPlanId",
            values: plans.map((plan) => integer(plan.payoutPlanId)),
          }
        )
  ).filter((payout) => integer(payout.amount) > 0n);
  const planOf = new Map(plans.map((plan) => [integer(plan.payoutPlanId), plan]));
  const stateOf = new Map(payments.map((row) => [String(row.id), row.state]));
  const unpaid = assigned.filter(
    (payout) => stateOf.get(String(payout.disbursementEntityId)) !== "CONFIRMED"
  );
  const membersOf = (payouts: readonly RawRow[]) =>
    new Set(
      payouts.flatMap((payout) =>
        typeof payout.contributor === "string" ? [payout.contributor.toLowerCase()] : []
      )
    );
  const tokenOfPayout = (payout: RawRow) => {
    const plan = planOf.get(integer(payout.payoutPlanId));
    if (!plan) throw new Error("Passport payout names no payment plan");
    return tokenOf(plan);
  };
  // Tokens are published apart, so each token's amount needs its own three members: three people
  // across two tokens would publish one member's amount in one of them.
  const sharedInEveryToken = (payouts: readonly RawRow[]) => {
    const members = new Map<Address, Set<string>>();
    for (const payout of payouts) {
      const token = tokenOfPayout(payout);
      const people = members.get(token) ?? new Set<string>();
      members.set(token, people);
      if (typeof payout.contributor === "string") people.add(payout.contributor.toLowerCase());
    }
    return [...members.values()].every((people) => people.size >= PUBLIC_PASSPORT_MIN_PEOPLE);
  };
  const byToken = (payouts: readonly RawRow[]) => {
    const totals = new Map<Address, bigint>();
    for (const payout of payouts) {
      const token = tokenOfPayout(payout);
      totals.set(token, (totals.get(token) ?? 0n) + integer(payout.amount));
    }
    return [...totals.entries()]
      .map(([token, amount]) => ({ token, amount }))
      .sort((left, right) => left.token.localeCompare(right.token));
  };

  const people = membersOf(assigned);
  for (const row of toMemberRows) {
    const member = memberOf(row);
    if (member) people.add(member);
  }
  // A plan with no payment yet still declares what named members are due, so it waits too.
  const withheld =
    (toMemberRows.length > 0 || plans.length > 0) && people.size < PUBLIC_PASSPORT_MIN_PEOPLE;
  // Three people overall is not three people behind each amount: a single failed payment would
  // publish one member's pay. Each amount waits until three members stand behind it.
  const lines =
    toMembers.fewestPeopleBehindAnAmount >= PUBLIC_PASSPORT_MIN_PEOPLE ? toMembers.lines : null;
  // A plan that has not assigned its members' amounts leaves the declared total unknown.
  const everyPlanAssigned = plans.every((plan) =>
    assigned.some((payout) => integer(payout.payoutPlanId) === integer(plan.payoutPlanId))
  );
  // Declared minus the published amounts is what plans assign that no payment records yet. That
  // remainder is a figure too, so the declared total stands beside the amounts only when the
  // remainder is nothing or is itself shared by three members, token by token.
  const unrecorded = assigned.filter((payout) => !stateOf.has(String(payout.disbursementEntityId)));
  const declared =
    everyPlanAssigned &&
    sharedInEveryToken(assigned) &&
    (lines === null || sharedInEveryToken(unrecorded))
      ? byToken(assigned)
      : null;
  const declaredUnpaid = declared !== null && lines !== null ? byToken(unpaid) : null;

  const waitingForPlan = promises.filter(
    (row) => row.kept && row.declaresPayment && !row.hasPaymentPlan
  );
  // A promise kept with no plan changes this section without any payment row changing.
  const changed = [
    ...[...payments, ...plans, ...assigned].flatMap((row) =>
      typeof row.updatedAt === "number" ? [row.updatedAt] : []
    ),
    ...waitingForPlan.map((row) => row.updatedAt),
  ];
  return {
    asOf: changed.length === 0 ? null : Math.max(...changed),
    settlement: {
      keptAwaitingPaymentPlan: waitingForPlan.length,
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
            declared,
            declaredUnpaid,
            payments: toMembers.payments,
            lines,
          },
    },
  };
}
