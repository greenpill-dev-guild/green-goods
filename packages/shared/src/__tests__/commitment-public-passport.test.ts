import { type ObjectValueNode, parse, visit } from "graphql";
import { describe, expect, it } from "vitest";

import type { GraphQLReader } from "../modules/data/graphql-client";
import { getPublicGardenPassport } from "../modules/commitment-pooling/data-public-passport";
import { GREEN_GOODS_ISSUER_ROUTE } from "../modules/commitment-pooling/service-issuer-live-config";
import type { PassportSection } from "../modules/commitment-pooling/public-passport-types";
import type { Address } from "../types/domain";

const CHAIN = 42161;
const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const GDOLLAR = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a";
// The reviewed pilot voucher, so the passport can name it.
const VOUCHER = GREEN_GOODS_ISSUER_ROUTE.assets[0].token.address.toLowerCase();
const NOW = 2_000_000;
type Row = Record<string, unknown>;

const person = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

function promise(id: number, fields: Row = {}): Row {
  return {
    id: `${CHAIN}-${String(id).padStart(4, "0")}`,
    commitmentId: String(id),
    poolId: "7",
    cycleId: "9",
    direction: "REQUEST",
    state: "ACCEPTED",
    acceptanceSeen: true,
    countedLifecycleStates: [],
    unitLabel: "hub days",
    targetUnits: "4",
    approvedUnits: "0",
    leadProvider: person(id),
    creator: person(900 + id),
    dueDate: String(NOW + 1000),
    confirmationPath: null,
    createdAt: 1000 + id,
    updatedAt: 5000 + id,
    ...fields,
  };
}

const kept = (id: number, fields: Row = {}) =>
  promise(id, {
    state: "FULFILLED",
    countedLifecycleStates: ["FULFILLED"],
    confirmationPath: "ORDINARY",
    ...fields,
  });

/** A query the indexer would refuse is a failed read, as it is in production. */
function refusal(document: string): Error | null {
  try {
    let duplicate: string | null = null;
    visit(parse(document), {
      ObjectValue(node: ObjectValueNode) {
        const names = node.fields.map((field) => field.name.value);
        duplicate ??= names.find((name, index) => names.indexOf(name) !== index) ?? null;
      },
    });
    return duplicate ? new Error(`There can be only one input field named "${duplicate}"`) : null;
  } catch (error) {
    return error as Error;
  }
}

/**
 * Serves the rows a test names as the indexer would: scoped to a pool or to the ids asked for,
 * paged by id, and refusing a document that is not valid GraphQL.
 */
function indexer(tables: Record<string, Row[] | Error>, poolId: string | null = "7") {
  const calls: { entity: string; variables: Row; document: string }[] = [];
  const reader: GraphQLReader = {
    query: async (document, input, operationName = "") => {
      const variables: Row = input ?? {};
      const refused = refusal(String(document));
      if (refused) return { error: refused };
      if (operationName === "getPublicPassportPool") {
        const pools = poolId === null ? [] : [{ id: `${CHAIN}-${poolId}`, poolId }];
        return { data: { CommitmentPool: pools } as never };
      }
      const entity = operationName.replace("getPublicPassport", "");
      calls.push({ entity, variables, document: String(document) });
      const table = tables[entity] ?? [];
      if (table instanceof Error) return { error: table };
      const ids = variables.ids as string[] | undefined;
      const byCommitment = String(document).includes("[numeric!]!");
      const rows = table
        .filter((row) => variables.poolId === undefined || row.poolId === variables.poolId)
        .filter((row) => !ids || ids.includes(String(byCommitment ? row.commitmentId : row.id)))
        .filter((row) => String(row.id) > String(variables.after))
        .sort((left, right) => String(left.id).localeCompare(String(right.id)))
        .slice(0, 100);
      return { data: { [entity]: rows } as never };
    },
  };
  return { reader, calls };
}

function read(tables: Record<string, Row[] | Error>, poolId: string | null = "7", chain = CHAIN) {
  return getPublicGardenPassport(chain, GARDEN, {
    now: NOW,
    reader: indexer(tables, poolId).reader,
  });
}

function value<T>(section: PassportSection<T>): T {
  if (section.status !== "available") throw new Error("section is unavailable");
  return section.value;
}

function payment(n: number, fields: Row = {}): Row {
  return {
    id: `${CHAIN}-pay-${String(n).padStart(3, "0")}`,
    kind: "FUNDING",
    state: "CONFIRMED",
    token: GDOLLAR,
    amount: "100",
    recipient: GARDEN,
    commitmentId: null,
    updatedAt: 9600 + n,
    ...fields,
  };
}

describe("a garden's passport", () => {
  it("counts what was promised, kept and left open without splitting a small record", async () => {
    const passport = await read({
      Commitment: [
        kept(1),
        promise(2, { approvedUnits: "1" }),
        promise(3, { state: "EXPIRED" }),
        // Released by both sides: nobody answers for it.
        promise(4, { state: "CANCELLED" }),
        // An expired request nobody took up is not a broken promise.
        promise(5, { acceptanceSeen: false, state: "EXPIRED", leadProvider: null }),
      ],
    });

    const promises = value(passport.promises);
    expect(promises).toMatchObject({ made: 5, takenUp: 4, due: 3, kept: 1, unresolved: 2 });
    expect(promises.since).toBe(1001);
    // Three promises due: below the floor, so nothing says which unresolved one lapsed.
    expect(promises.breakdown).toBeNull();
    expect(promises.units).toEqual([
      {
        unitLabel: "hub days",
        promised: 12n,
        delivered: 5n,
        undelivered: 7n,
        stillToDeliver: null,
        notDelivered: null,
        onOffer: 0n,
      },
    ]);
    expect(passport.promises).toMatchObject({ status: "available", asOf: 5005 });
    expect(passport.partialData).toBe(false);
  });

  it("splits the unresolved promises once enough people stand behind the record", async () => {
    const passport = await read({
      Commitment: [
        kept(1),
        kept(2),
        kept(3),
        promise(4, { approvedUnits: "3" }),
        promise(5, { state: "READY_FOR_CONFIRMATION", approvedUnits: "9" }),
        promise(6, { state: "EXPIRED", approvedUnits: "1" }),
        // Past its due date, and nobody has closed it: still open, and said to be past due.
        promise(7, { unitLabel: "workshops", targetUnits: "2", dueDate: String(NOW - 5) }),
      ],
    });

    const promises = value(passport.promises);
    expect(promises.breakdown).toEqual({
      stillOpen: 3,
      awaitingConfirmation: 1,
      notKept: 1,
      partlyDelivered: 2,
      pastDue: 1,
    });
    // Approved units never exceed the promise; units under another label stay on their own line.
    expect(promises.units).toEqual([
      {
        unitLabel: "hub days",
        promised: 24n,
        delivered: 20n,
        undelivered: 4n,
        stillToDeliver: 1n,
        notDelivered: 3n,
        onOffer: 0n,
      },
      {
        unitLabel: "workshops",
        promised: 2n,
        delivered: 0n,
        undelivered: 2n,
        stillToDeliver: 2n,
        notDelivered: 0n,
        onOffer: 0n,
      },
    ]);

    // Five promises due from one person, with two other people's untaken offers beside them:
    // offers add no cover, so that one person's lapsed promise is not split out.
    const onePerson = await read({
      Commitment: [
        ...[1, 2, 3, 4].map((id) => kept(id, { leadProvider: person(1) })),
        promise(5, { state: "EXPIRED", leadProvider: person(1) }),
        ...[6, 7].map((id) =>
          promise(id, {
            direction: "OFFER",
            state: "OFFERED",
            acceptanceSeen: false,
            leadProvider: null,
          })
        ),
      ],
    });
    expect(value(onePerson.promises)).toMatchObject({ due: 5, breakdown: null });
  });

  it("leaves a registered rehearsal, and what followed it, out of every figure", async () => {
    // Pool 1, cycle 1 on Arbitrum is the registered rehearsal.
    const rehearsal = { poolId: "1", cycleId: "1" };
    const passport = await read(
      {
        Commitment: [kept(1, rehearsal), kept(2, { poolId: "1", cycleId: "2" })],
        Disbursement: [
          payment(1, { commitmentId: "1" }),
          payment(2, { commitmentId: "2", amount: "70" }),
        ],
        // A booking against the rehearsal promise is not a booking on the record.
        VoucherServiceSetup: [
          { id: "setup-1", commitmentId: "1", holder: person(1), token: VOUCHER, updatedAt: 1 },
        ],
      },
      "1"
    );

    expect(value(passport.promises)).toMatchObject({ made: 1, kept: 1 });
    expect(value(passport.settlement).support.lines).toMatchObject([{ confirmed: 70n }]);
    expect(value(passport.vouchers).bookings).toMatchObject({ withheld: false, requested: 0 });

    // Pool 2's promise 85 was made outside any cycle and is registered by its own id.
    const single = await read(
      {
        Commitment: [
          kept(85, { poolId: "2", cycleId: null }),
          kept(86, { poolId: "2", cycleId: null }),
        ],
        Disbursement: [payment(3, { commitmentId: "85" })],
      },
      "2"
    );
    expect(value(single.promises)).toMatchObject({ made: 1, kept: 1 });
    expect(value(single.settlement).support.lines).toEqual([]);
  });

  it("reads open offers as capacity, and only voucher-priced ones as bookable with a voucher", async () => {
    const offer = (id: number, fields: Row = {}) =>
      promise(id, {
        direction: "OFFER",
        state: "OFFERED",
        acceptanceSeen: false,
        leadProvider: null,
        dueDate: "0",
        ...fields,
      });
    const revision = (commitmentId: number, n: number, paymentRoute: number) => ({
      id: `rev-${commitmentId}-${n}`,
      commitmentId: String(commitmentId),
      revision: String(n),
      paymentRoute,
      timestamp: 7000,
    });
    const passport = await read({
      Commitment: [
        offer(1),
        offer(2, { unitLabel: "seat days", targetUnits: "30" }),
        // Past its term: nobody can take it up, so it is no longer capacity.
        offer(3, { dueDate: String(NOW - 1) }),
        offer(4),
      ],
      ServiceOfferRevision: [
        revision(1, 1, 2),
        revision(2, 1, 2),
        // The latest revision decides: this offer went back to G$.
        revision(4, 1, 2),
        revision(4, 2, 1),
      ],
    });

    const promises = value(passport.promises);
    expect(promises.standingOffers).toBe(3);
    expect(promises.due).toBe(0);
    expect(promises.units.map((line) => [line.unitLabel, line.onOffer, line.promised])).toEqual([
      ["hub days", 8n, 0n],
      ["seat days", 30n, 0n],
    ]);
    const vouchers = value(passport.vouchers);
    expect(vouchers.offersBookable).toBe(2);
    expect(vouchers.capacityOnOffer).toEqual([
      { unitLabel: "hub days", units: 4n },
      { unitLabel: "seat days", units: 30n },
    ]);
    expect(vouchers.earned).toMatchObject({ withheld: false, recorded: 0, issued: 0 });
    expect(vouchers.bookings).toMatchObject({ withheld: false, requested: 0 });
  });

  it("traces each issued award to a kept promise and how it was confirmed", async () => {
    const award = (commitmentId: number, delivered: boolean | null) => ({
      id: `award-${commitmentId}`,
      entitlementId: `0x${commitmentId}`,
      commitmentId: String(commitmentId),
      delivered,
      updatedAt: 8000 + commitmentId,
    });
    const tables = {
      Commitment: [
        kept(1),
        kept(2, { confirmationPath: "POOL_FALLBACK" }),
        kept(3),
        promise(4),
        promise(5),
      ],
      EarnedVoucherTerms: [1, 2, 3, 4].map((id) => ({
        id: `terms-${id}`,
        commitmentId: String(id),
        revision: "1",
        approvedSeen: id !== 4,
        updatedAt: 6000,
      })),
      EarnedVoucherDistribution: [
        award(1, true),
        award(2, true),
        award(3, false),
        award(4, true),
        award(5, null),
      ],
    };
    const passport = await read(tables);

    expect(value(passport.vouchers).earned).toEqual({
      withheld: false,
      promisesWithApprovedTerms: 3,
      recorded: 5,
      issued: 3,
      failed: 1,
      awaiting: 1,
      // The award on promise 4 was issued, but its promise is not on record as kept.
      tracedToKeptPromise: 2,
      confirmedByOwnConfirmers: 1,
      confirmedByFallback: 1,
    });
    expect(passport.vouchers).toMatchObject({ asOf: 8005 });

    const few = await read({
      ...tables,
      EarnedVoucherDistribution: [award(1, true), award(2, false)],
    });
    expect(value(few.vouchers).earned).toEqual({ withheld: true });
  });

  it("keeps presentment, confirmed delivery and discharge apart for services booked with vouchers", async () => {
    const booking = (n: number, fields: Row = {}) => ({
      id: `setup-${n}`,
      commitmentId: "1",
      holder: person(n),
      token: VOUCHER,
      voucherUnits: "10",
      serviceUnits: "30",
      unitLabelHash: "0xseat",
      latestSetupResultId: `result-${n}`,
      latestFinalResultId: null,
      updatedAt: 9000 + n,
      ...fields,
    });
    const result = (n: number, phase: number, refunded = "0") => ({
      id: `result-${n}`,
      phase,
      depositedUnits: "10",
      setupRefundedUnits: refunded,
      timestamp: 9100,
    });
    // This garden also provides a service offered in another pool.
    const elsewhere = (n: number) =>
      booking(n, { commitmentId: "50", serviceUnits: "45", unitLabelHash: "0xminutes" });
    const tables = {
      Commitment: [
        promise(1, { unitLabel: "seat days", targetUnits: "90" }),
        promise(50, { poolId: "3", unitLabel: "minutes" }),
        // A promise in the registered rehearsal cycle of another pool.
        promise(60, { poolId: "1", cycleId: "1" }),
      ],
      VoucherServiceSetup: [
        // Delivered in part: the holder approved 20 of 30 seat days.
        booking(1, { latestFinalResultId: "final-1" }),
        booking(2),
        // Ended after the deposit: the vouchers went back.
        booking(3),
        // A booking with no result yet presented nothing.
        booking(4, { latestSetupResultId: null }),
        elsewhere(5),
        elsewhere(6),
        elsewhere(7),
        booking(8, { commitmentId: "60" }),
      ],
      VoucherServiceSetupResult: [
        result(1, 3),
        result(2, 3),
        result(3, 5, "10"),
        result(5, 3),
        result(6, 3),
        result(7, 3),
        result(8, 3),
      ],
      VoucherServiceFinalResult: [
        {
          id: "final-1",
          approvedDeliveredServiceUnits: "20",
          releaseVoucherUnits: "7",
          refundVoucherUnits: "3",
          releaseState: 3,
          refundState: 2,
          timestamp: 9500,
        },
      ],
    };
    const passport = await read(tables);

    // Seven bookings: the one against the rehearsal promise is not on the record.
    expect(value(passport.vouchers).bookings).toEqual({
      withheld: false,
      requested: 7,
      accepted: 5,
      notStarted: 1,
      settled: 1,
      transfersFailed: 1,
      amounts: {
        // Minutes and seat days are different services and never one figure.
        services: [
          { unitLabel: "minutes", booked: 135n, confirmedDelivered: 0n },
          { unitLabel: "seat days", booked: 90n, confirmedDelivered: 20n },
        ],
        vouchers: [
          {
            token: VOUCHER,
            symbol: "GGV",
            decimals: 6,
            presented: 60n,
            returnedToIssuer: 7n,
            refundedToHolder: 10n,
            awaitingTransfer: 3n,
          },
        ],
      },
    });

    // Five people booked, but one service has a single booking: its units would be that
    // person's, so no unit figure is published while the counts stay.
    const oneLineThin = await read({
      ...tables,
      VoucherServiceSetup: tables.VoucherServiceSetup.slice(0, 5),
    });
    expect(value(oneLineThin.vouchers).bookings).toMatchObject({
      withheld: false,
      requested: 5,
      amounts: null,
    });

    const few = await read({
      ...tables,
      VoucherServiceSetup: tables.VoucherServiceSetup.slice(0, 2),
    });
    expect(value(few.vouchers).bookings).toEqual({ withheld: true });
  });

  it("reconciles declared payments against what was confirmed, sent, queued and failed", async () => {
    const member = (n: number, state: string, amount: string) =>
      payment(10 + n, {
        kind: "CONTRIBUTOR_CONSIDERATION",
        state,
        amount,
        recipient: person(n),
        commitmentId: "1",
      });
    const plan = (n: number, fields: Row = {}) => ({
      id: `plan-${n}`,
      commitmentId: String(n),
      token: GDOLLAR,
      declaredAmount: "100",
      finalized: true,
      latestEditReasonCID: null,
      updatedAt: 9700,
      ...fields,
    });
    const tables = {
      Commitment: [
        kept(1, { considerationRail: "CELO_SETTLEMENT", payoutPlanId: "1" }),
        // Kept, with a payment declared and no plan: nothing says it was paid.
        kept(2, { considerationRail: "CELO_SETTLEMENT", payoutPlanId: null }),
        kept(3, { considerationRail: "NONE" }),
        promise(4, { considerationRail: "CELO_SETTLEMENT" }),
      ],
      Disbursement: [
        payment(1, { amount: "500" }),
        payment(2, { kind: "GARDEN_BENEFICIARY", state: "DISPATCHED", amount: "40" }),
        payment(3, { state: "QUEUED", amount: "9" }),
        member(1, "CONFIRMED", "20"),
        member(2, "CONFIRMED", "20"),
        member(3, "CONFIRMED", "20"),
        member(4, "QUEUED", "10"),
        member(5, "QUEUED", "10"),
        member(6, "QUEUED", "5"),
      ],
      CommitmentPayoutPlan: [
        // 100 declared: 10 stays with the garden, so 90 is declared for its members.
        plan(1, { gardenRetainedAmount: "10" }),
        plan(2, { finalized: false, latestEditReasonCID: "bafyreason", declaredAmount: "30" }),
      ],
    };
    const { reader, calls } = indexer(tables);
    const settlement = value(
      (await getPublicGardenPassport(CHAIN, GARDEN, { now: NOW, reader })).settlement
    );

    expect(settlement.keptAwaitingPaymentPlan).toBe(1);
    // Queued is not sent, and sent is not received.
    expect(settlement.support).toEqual({
      payments: { confirmed: 1, sent: 1, queued: 1, failed: 0, cancelled: 0 },
      lines: [
        { token: GDOLLAR, confirmed: 500n, sent: 40n, queued: 9n, failed: 0n, cancelled: 0n },
      ],
    });
    // 120 declared for members, 60 paid: a declared, queued or sent amount is never received.
    expect(settlement.memberPayments).toEqual({
      withheld: false,
      plans: 2,
      plansFinalized: 1,
      plansRevised: 1,
      declared: [{ token: GDOLLAR, amount: 120n }],
      payments: { confirmed: 3, sent: 0, queued: 3, failed: 0, cancelled: 0 },
      lines: [{ token: GDOLLAR, confirmed: 60n, sent: 0n, queued: 25n, failed: 0n, cancelled: 0n }],
    });
    // Only plans that pay members are read as member plans.
    expect(calls.find((call) => call.entity === "CommitmentPayoutPlan")?.document).toContain(
      "payoutKind: { _eq: CONTRIBUTOR_CONSIDERATION }"
    );

    // One failed payment would publish one member's pay: the amounts wait, the counts stay.
    const oneFailed = value(
      (await read({ ...tables, Disbursement: [...tables.Disbursement, member(7, "FAILED", "15")] }))
        .settlement
    );
    expect(oneFailed.memberPayments).toMatchObject({
      withheld: false,
      payments: { confirmed: 3, queued: 3, failed: 1 },
      declared: [{ token: GDOLLAR, amount: 120n }],
      lines: null,
    });

    // Two members paid, or a plan with nobody paid yet: figures that would point at a person wait.
    for (const rows of [tables.Disbursement.slice(0, 5), tables.Disbursement.slice(0, 3)]) {
      const few = value((await read({ ...tables, Disbursement: rows })).settlement);
      expect(few.memberPayments).toEqual({ withheld: true });
      expect(few.support.payments.confirmed).toBe(1);
    }
  });

  it("says a source is unavailable instead of publishing a zero for it", async () => {
    const failed = new Error("indexer timeout");
    const base = { Commitment: [kept(1)], Disbursement: [payment(1)] };

    // Vouchers and payments are joined to promises, so they cannot stand without them.
    const noPromises = await read({ ...base, Commitment: failed });
    expect(noPromises.unavailableSources).toEqual({
      promises: true,
      vouchers: true,
      settlement: true,
    });

    const noVouchers = await read({ ...base, VoucherServiceSetup: failed });
    expect(noVouchers.unavailableSources).toEqual({
      promises: false,
      vouchers: true,
      settlement: false,
    });
    expect(noVouchers.partialData).toBe(true);

    // A payment in a state the reader does not know must not be counted as anything.
    const unknown = await read({ ...base, Disbursement: [payment(1, { state: "UNKNOWN" })] });
    expect(unknown.settlement).toEqual({ status: "unavailable" });

    // A garden with no pool has an empty record, which is a real answer.
    const noPool = await read({}, null);
    expect(noPool.poolId).toBeNull();
    expect(value(noPool.promises)).toMatchObject({ made: 0, since: null, units: [] });
    expect(noPool.promises).toMatchObject({ asOf: null });
    expect(noPool.partialData).toBe(false);
  });

  it("reads a long record in pages and scopes every read to the garden", async () => {
    const { reader, calls } = indexer({
      Commitment: Array.from({ length: 230 }, (_, index) => kept(index + 1)),
    });
    const passport = await getPublicGardenPassport(CHAIN, GARDEN.toUpperCase() as Address, {
      now: NOW,
      reader,
    });

    expect(value(passport.promises)).toMatchObject({ made: 230, kept: 230 });
    expect(
      calls.filter((call) => call.entity === "Commitment" && call.variables.poolId)
    ).toHaveLength(3);
    for (const entity of ["VoucherServiceSetup", "Disbursement", "CommitmentPayoutPlan"]) {
      expect(calls.find((call) => call.entity === entity)?.variables).toMatchObject({
        chainId: CHAIN,
        garden: GARDEN,
      });
    }
  });
});
