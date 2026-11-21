import { type ObjectValueNode, parse, visit } from "graphql";
import { decodeFunctionData, encodeFunctionResult, parseAbi } from "viem";
import { describe, expect, it } from "vitest";

import type { GraphQLReader } from "../modules/data/graphql-client";
import { getPublicGardenPassport } from "../modules/commitment-pooling/data-public-passport";
import type { PassportVoucherChain } from "../modules/commitment-pooling/data-public-passport-supply";
import { GREEN_GOODS_ISSUER_ROUTE } from "../modules/commitment-pooling/service-issuer-live-config";
import type { PassportSection } from "../modules/commitment-pooling/public-passport-types";
import type { Address } from "../types/domain";
import { getNetworkContracts } from "../utils/blockchain/contracts";

const CHAIN = 42161;
const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const GDOLLAR = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a";
// Sorts before G$, so a mixed count would show first.
const OTHER_TOKEN = "0x0000000000000000000000000000000000000099";
// The reviewed pilot voucher, so the passport can name it.
const VOUCHER = GREEN_GOODS_ISSUER_ROUTE.assets[0].token.address.toLowerCase();
const NOW = 2_000_000;
type Row = Record<string, unknown>;

// The deployed promise module, and the two voucher modules it pins in these tests.
const CORE = getNetworkContracts(CHAIN).commitmentPoolingModule.toLowerCase();
const EARNED = `0x${"e".repeat(40)}`;
const BOOKINGS = `0x${"b".repeat(40)}`;
const OTHER_MODULE = `0x${"d".repeat(40)}`;
const PINS = [
  {
    id: `${CHAIN}-${CORE}`,
    earnedModule: EARNED,
    serviceSetupModule: BOOKINGS,
    earnedPinSeen: true,
    servicePinSeen: true,
  },
];

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
      // The field the ids are matched on: a promise id, a plan id or the row's own id.
      const idField = /(\w+): \{ _in: \$ids/.exec(String(document))?.[1] ?? "id";
      const rows = table
        .filter((row) => variables.poolId === undefined || row.poolId === variables.poolId)
        // Promises are also read by the garden that provides them, in any pool.
        .filter(
          (row) =>
            entity !== "Commitment" ||
            variables.garden === undefined ||
            row.providerGarden === variables.garden
        )
        .filter((row) => variables.module === undefined || row.moduleAddress === variables.module)
        .filter((row) => variables.core === undefined || row.coreModule === variables.core)
        .filter((row) => !ids || ids.includes(String(row[idField])))
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
    reader: indexer({ VoucherCoreConfiguration: PINS, ...tables }, poolId).reader,
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

  it("reads a promise as the garden's when the garden provides it, in whichever pool", async () => {
    const elsewhere = { poolId: "1", providerGarden: GARDEN };
    const { reader, calls } = indexer({
      VoucherCoreConfiguration: PINS,
      Commitment: [
        kept(1),
        // Taken up in this garden's pool by another garden: that garden's promise to keep.
        promise(2, { providerGarden: `0x${"2".repeat(40)}` }),
        // Taken up by this garden in the protocol pool.
        kept(3, { ...elsewhere, cycleId: "5" }),
        // The same, in the registered rehearsal: pool 1, cycle 1.
        kept(4, { ...elsewhere, cycleId: "1" }),
      ],
      Disbursement: [payment(1, { commitmentId: "4" }), payment(2, { amount: "70" })],
    });
    const passport = await getPublicGardenPassport(CHAIN, GARDEN, { now: NOW, reader });

    expect(value(passport.promises)).toMatchObject({ made: 2, due: 2, kept: 2 });
    expect(value(passport.settlement).support.lines).toMatchObject([{ confirmed: 70n }]);
    // The rehearsal was found with the garden's own promises: no further read was needed for it.
    expect(calls.filter((call) => call.entity === "Commitment" && call.variables.ids)).toEqual([]);
    // A garden with no pool of its own still has the promises it took up elsewhere.
    const noPool = await read({ Commitment: [kept(3, { ...elsewhere, cycleId: "5" })] }, null);
    expect(value(noPool.promises)).toMatchObject({ made: 1, kept: 1 });
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
        promise(8, { unitLabel: "workshops", targetUnits: "2" }),
        promise(9, { unitLabel: "workshops", targetUnits: "2" }),
      ],
    });

    const promises = value(passport.promises);
    expect(promises.breakdown).toEqual({
      stillOpen: 5,
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
        promised: 6n,
        delivered: 0n,
        undelivered: 6n,
        stillToDeliver: 6n,
        notDelivered: 0n,
        onOffer: 0n,
      },
    ]);

    // Four hub days kept by three people, one workshop lapsed by a fourth. Units are listed
    // apart, so any split would say by elimination that the one workshop promise lapsed. With
    // a unit that one person alone promised still unresolved, the whole record stays unsplit.
    const oneUnitThin = await read({
      Commitment: [
        kept(1),
        kept(2),
        kept(3),
        kept(4, { leadProvider: person(1) }),
        promise(5, { unitLabel: "workshops", targetUnits: "2", state: "EXPIRED" }),
      ],
    });
    expect(value(oneUnitThin.promises)).toMatchObject({ due: 5, kept: 4, breakdown: null });
    expect(value(oneUnitThin.promises).units.map((unit) => unit.notDelivered)).toEqual([
      null,
      null,
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
          {
            id: "setup-1",
            commitmentId: "1",
            holder: person(1),
            token: VOUCHER,
            moduleAddress: BOOKINGS,
            coreModule: CORE,
            updatedAt: 1,
          },
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

    // A garden with its own pool that provided for promise 85 in pool 2: still a rehearsal.
    const provider = await read({
      Commitment: [
        kept(85, { poolId: "2", cycleId: null }),
        kept(86, { poolId: "2", cycleId: null }),
      ],
      Disbursement: [
        payment(3, { commitmentId: "85" }),
        payment(4, { commitmentId: "86", amount: "30" }),
      ],
    });
    expect(value(provider.settlement).support.lines).toMatchObject([{ confirmed: 30n }]);
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
    const revision = (commitmentId: number, n: number, paymentRoute: number, module = CORE) => ({
      id: `rev-${module}-${commitmentId}-${n}`,
      moduleAddress: module,
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
        // Another module used the same promise id: its record is not this garden's offer.
        revision(4, 3, 2, OTHER_MODULE),
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
    // The offers themselves date the figure: taking one up changes it with no new revision.
    expect(passport.vouchers).toMatchObject({ asOf: 7000 });
  });

  it("traces each issued award to a kept promise and how it was confirmed", async () => {
    const award = (commitmentId: number, delivered: boolean | null, module = EARNED) => ({
      id: `award-${module}-${commitmentId}`,
      moduleAddress: module,
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
        moduleAddress: EARNED,
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
        // An award another module recorded for the same promise id is not this garden's.
        award(1, true, OTHER_MODULE),
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
      EarnedVoucherTerms: tables.EarnedVoucherTerms.slice(0, 2),
      EarnedVoucherDistribution: [award(1, true), award(2, false)],
    });
    expect(value(few.vouchers).earned).toEqual({ withheld: true });

    // Terms are approved before any award exists: two people's approved terms wait as well.
    const termsOnly = await read({
      ...tables,
      EarnedVoucherTerms: tables.EarnedVoucherTerms.slice(0, 2),
      EarnedVoucherDistribution: [],
    });
    expect(value(termsOnly.vouchers).earned).toEqual({ withheld: true });

    // Until the promise module pins an earned-voucher module, no award can count.
    const unpinned = await read({ ...tables, VoucherCoreConfiguration: [] });
    expect(value(unpinned.vouchers).earned).toMatchObject({ withheld: false, recorded: 0 });
  });

  it("keeps presentment, confirmed delivery and discharge apart for services booked with vouchers", async () => {
    const booking = (n: number, fields: Row = {}) => ({
      id: `setup-${String(n).padStart(2, "0")}`,
      moduleAddress: BOOKINGS,
      coreModule: CORE,
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
    const final = (n: number, refundState = 3) => ({
      id: `final-${n}`,
      approvedDeliveredServiceUnits: "20",
      releaseVoucherUnits: "7",
      refundVoucherUnits: "3",
      releaseState: 3,
      refundState,
      timestamp: 9500,
    });
    // Delivered in part: each holder approved 20 of 30 seat days.
    const delivered = (n: number) => booking(n, { latestFinalResultId: `final-${n}` });
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
        delivered(1),
        delivered(2),
        delivered(3),
        elsewhere(5),
        elsewhere(6),
        elsewhere(7),
        booking(8, { commitmentId: "60" }),
        // Recorded by a module the promise module never pinned: not this garden's booking.
        booking(9, { moduleAddress: OTHER_MODULE }),
      ],
      VoucherServiceSetupResult: [1, 2, 3, 5, 6, 7, 8, 9].map((n) => result(n, 3)),
      VoucherServiceFinalResult: [final(1), final(2), final(3)],
    };
    const passport = await read(tables);

    // Six bookings: the rehearsal one and the other module's are not on the record.
    expect(value(passport.vouchers).bookings).toEqual({
      withheld: false,
      requested: 6,
      accepted: 6,
      notStarted: 0,
      settled: 3,
      transfersFailed: 0,
      amounts: {
        // Minutes and seat days are different services and never one figure. Vouchers going
        // back to the issuer (21) are counted apart from what the holders approved (60).
        services: [
          { unitLabel: "minutes", booked: 135n, confirmedDelivered: 0n },
          { unitLabel: "seat days", booked: 90n, confirmedDelivered: 60n },
        ],
        vouchers: [
          {
            token: VOUCHER,
            symbol: "GGV",
            decimals: 6,
            presented: 60n,
            returnedToIssuer: 21n,
            refundedToHolder: 9n,
            awaitingTransfer: 0n,
          },
        ],
      },
    });

    // A fourth booking ended after its deposit, and one refund failed. Seven people booked, but
    // the units waiting to move are one person's, so no unit figure is published. Counts stay.
    const oneFigureThin = await read({
      ...tables,
      VoucherServiceSetup: [...tables.VoucherServiceSetup, booking(4), delivered(10)],
      VoucherServiceSetupResult: [
        ...tables.VoucherServiceSetupResult,
        result(4, 5, "10"),
        result(10, 3),
      ],
      VoucherServiceFinalResult: [...tables.VoucherServiceFinalResult, final(10, 2)],
    });
    expect(value(oneFigureThin.vouchers).bookings).toEqual({
      withheld: false,
      requested: 8,
      accepted: 7,
      notStarted: 1,
      settled: 4,
      transfersFailed: 1,
      amounts: null,
    });

    // Three bookings settled in full and a fourth still active: every published figure has
    // three holders, but presented minus returned would be the fourth holder's units in escrow.
    const settledInFull = (n: number) => ({
      ...final(n),
      approvedDeliveredServiceUnits: "30",
      releaseVoucherUnits: "10",
      refundVoucherUnits: "0",
      refundState: 0,
    });
    const oneInEscrow = await read({
      Commitment: tables.Commitment,
      VoucherServiceSetup: [delivered(1), delivered(2), delivered(3), booking(4)],
      VoucherServiceSetupResult: [1, 2, 3, 4].map((n) => result(n, 3)),
      VoucherServiceFinalResult: [1, 2, 3].map(settledInFull),
    });
    expect(value(oneInEscrow.vouchers).bookings).toMatchObject({
      withheld: false,
      requested: 4,
      settled: 3,
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
        // The payment goes to another address than the member's own: the member is who counts.
        contributor: person(n),
        recipient: person(500 + n),
        commitmentId: "1",
      });
    const plan = (n: number, fields: Row = {}) => ({
      id: `plan-${n}`,
      payoutPlanId: String(n),
      commitmentId: String(n),
      token: GDOLLAR,
      finalized: true,
      latestEditReasonCID: null,
      updatedAt: 9700,
      ...fields,
    });
    // What a plan assigns to one member, tied to that member's payment once one exists.
    const share = (planId: number, n: number, amount: string, paid = true) => ({
      id: `share-${planId}-${String(n).padStart(2, "0")}`,
      payoutPlanId: String(planId),
      contributor: person(n),
      amount,
      disbursementEntityId: paid ? member(n, "", "").id : null,
      updatedAt: 9650,
    });
    const tables = {
      Commitment: [
        kept(1, { considerationRail: "CELO_SETTLEMENT", payoutPlanId: "1" }),
        // Kept, with a payment declared and no plan: nothing says it was paid.
        kept(2, { considerationRail: "CELO_SETTLEMENT", payoutPlanId: null, updatedAt: 9900 }),
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
        payment(40, { token: OTHER_TOKEN, amount: "3" }),
      ],
      CommitmentPayoutPlan: [
        plan(1),
        plan(2, { finalized: false, latestEditReasonCID: "bafyreason" }),
      ],
      ContributorPayout: [
        share(1, 1, "20"),
        share(1, 2, "20"),
        share(1, 3, "20"),
        share(2, 4, "10"),
        share(2, 5, "10"),
        share(2, 6, "5"),
      ],
    };
    const { reader, calls } = indexer({ VoucherCoreConfiguration: PINS, ...tables });
    const passport = await getPublicGardenPassport(CHAIN, GARDEN, { now: NOW, reader });
    const settlement = value(passport.settlement);

    expect(settlement.keptAwaitingPaymentPlan).toBe(1);
    // The promise kept without a plan dates this section, though no payment row changed.
    expect(passport.settlement).toMatchObject({ asOf: 9900 });
    // Queued is not sent, and sent is not received.
    // A count never mixes tokens, any more than an amount does.
    expect(settlement.support).toEqual({
      payments: [
        { token: OTHER_TOKEN, confirmed: 1, sent: 0, queued: 0, failed: 0, cancelled: 0 },
        { token: GDOLLAR, confirmed: 1, sent: 1, queued: 1, failed: 0, cancelled: 0 },
      ],
      lines: [
        { token: OTHER_TOKEN, confirmed: 3n, sent: 0n, queued: 0n, failed: 0n, cancelled: 0n },
        { token: GDOLLAR, confirmed: 500n, sent: 40n, queued: 9n, failed: 0n, cancelled: 0n },
      ],
    });
    // 85 declared for six members, 60 paid to three: the other three share the unpaid 25.
    expect(settlement.memberPayments).toEqual({
      withheld: false,
      plans: 2,
      plansFinalized: 1,
      plansRevised: 1,
      declared: [{ token: GDOLLAR, amount: 85n }],
      declaredUnpaid: [{ token: GDOLLAR, amount: 25n }],
      payments: [{ token: GDOLLAR, confirmed: 3, sent: 0, queued: 3, failed: 0, cancelled: 0 }],
      lines: [{ token: GDOLLAR, confirmed: 60n, sent: 0n, queued: 25n, failed: 0n, cancelled: 0n }],
    });
    // Only plans that pay members are read as member plans.
    expect(calls.find((call) => call.entity === "CommitmentPayoutPlan")?.document).toContain(
      "payoutKind: { _eq: CONTRIBUTOR_CONSIDERATION }"
    );

    const members = async (changes: Record<string, Row[]>) =>
      value((await read({ ...tables, ...changes })).settlement).memberPayments;

    // One failed payment would publish one member's pay: the amounts wait, the counts stay,
    // and the declared total stands alone, where nothing can be subtracted from it.
    expect(
      await members({
        Disbursement: [...tables.Disbursement, member(7, "FAILED", "15")],
        ContributorPayout: [...tables.ContributorPayout, share(2, 7, "15")],
      })
    ).toMatchObject({
      withheld: false,
      payments: [{ confirmed: 3, queued: 3, failed: 1 }],
      declared: [{ token: GDOLLAR, amount: 100n }],
      declaredUnpaid: null,
      lines: null,
    });

    // Three members in all is not three in each token. With the amounts held back, a plan that
    // assigns one member another token would publish that member's amount as that token's total.
    expect(
      await members({
        Disbursement: [...tables.Disbursement, member(7, "FAILED", "15")],
        CommitmentPayoutPlan: [...tables.CommitmentPayoutPlan, plan(3, { token: OTHER_TOKEN })],
        ContributorPayout: [
          ...tables.ContributorPayout,
          share(2, 7, "15"),
          share(3, 1, "7", false),
        ],
      })
    ).toMatchObject({ withheld: false, plans: 3, declared: null, lines: null });

    // A new plan with one member and no payment: declared minus paid would be that member's
    // amount, so the declared total is held while the paid amounts stay published.
    expect(
      await members({
        CommitmentPayoutPlan: [plan(1), plan(3)],
        Disbursement: tables.Disbursement.slice(0, 6),
        ContributorPayout: [...tables.ContributorPayout.slice(0, 3), share(3, 8, "40", false)],
      })
    ).toMatchObject({
      withheld: false,
      plans: 2,
      declared: null,
      declaredUnpaid: null,
      lines: [{ confirmed: 60n }],
    });

    // One plan assigns four members. Three payments are queued and the fourth is not recorded
    // yet: declared minus queued would be the fourth member's amount, so the total is held.
    expect(
      await members({
        CommitmentPayoutPlan: [plan(1)],
        Disbursement: [
          ...tables.Disbursement.slice(0, 3),
          member(1, "QUEUED", "10"),
          member(2, "QUEUED", "10"),
          member(3, "QUEUED", "10"),
        ],
        ContributorPayout: [
          share(1, 1, "10"),
          share(1, 2, "10"),
          share(1, 3, "10"),
          share(1, 8, "37", false),
        ],
      })
    ).toMatchObject({
      withheld: false,
      declared: null,
      declaredUnpaid: null,
      lines: [{ queued: 30n }],
    });

    // A plan that has not assigned its members' amounts leaves the declared total unknown.
    expect(
      await members({ ContributorPayout: tables.ContributorPayout.slice(0, 3) })
    ).toMatchObject({ withheld: false, declared: null, declaredUnpaid: null });

    // Two members in all, paid or only named in a plan: nothing about them is published.
    for (const changes of [
      {
        Disbursement: tables.Disbursement.slice(0, 5),
        ContributorPayout: tables.ContributorPayout.slice(0, 2),
      },
      {
        Disbursement: tables.Disbursement.slice(0, 3),
        ContributorPayout: [share(1, 1, "20", false)],
      },
    ]) {
      const few = value((await read({ ...tables, ...changes })).settlement);
      expect(few.memberPayments).toEqual({ withheld: true });
      expect(few.support.payments.find((count) => count.token === GDOLLAR)?.confirmed).toBe(1);
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
      // The voucher chain is read apart from the indexer, so it stands when the indexer fails.
      supply: false,
    });

    const noVouchers = await read({ ...base, VoucherServiceSetup: failed });
    expect(noVouchers.unavailableSources).toEqual({
      promises: false,
      vouchers: true,
      settlement: false,
      supply: false,
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
      VoucherCoreConfiguration: PINS,
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
    // Bookings are read from the pinned booking module acting for the deployed promise module.
    expect(calls.find((call) => call.entity === "VoucherServiceSetup")?.variables).toMatchObject({
      module: BOOKINGS,
      core: CORE,
    });
  });

  it("reads what the exchange pool holds from the voucher chain, and holds back what holders have", async () => {
    const VOUCHERS = 1_000_000n;
    const tsv = GREEN_GOODS_ISSUER_ROUTE.assets.find((asset) => asset.id === "tech-and-sun")!;
    const issuer = GREEN_GOODS_ISSUER_ROUTE.service.assets.find(
      (asset) => asset.token.toLowerCase() === tsv.token.address.toLowerCase()
    )!.garden!;
    const pool = GREEN_GOODS_ISSUER_ROUTE.pools[0];
    const abi = parseAbi([
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      "function limitOf(address,address) view returns (uint256)",
      "function have(address) view returns (bool)",
    ]);
    const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
    /** The voucher's token, its pool's limiter and registry, answering from one block. */
    const chain = (reserve: bigint, blocks: bigint[] = []): PassportVoucherChain => ({
      block: async () => ({ number: 77n, timestamp: 1_800_000 }),
      call: async (to, data, block) => {
        blocks.push(block);
        const { functionName, args } = decodeFunctionData({ abi, data });
        const answer = (): bigint | boolean => {
          if (functionName === "have" && same(to, pool.registry.address)) return true;
          if (functionName === "limitOf" && same(to, pool.limiter.address)) return 20n * VOUCHERS;
          if (!same(to, tsv.token.address)) throw new Error("unexpected contract");
          if (functionName === "totalSupply") return 20n * VOUCHERS;
          const holder = String(args?.[0]);
          if (same(holder, tsv.ownerReserve)) return reserve;
          if (same(holder, pool.deployment.address)) return 10n * VOUCHERS;
          throw new Error("unexpected holder");
        };
        return encodeFunctionResult({ abi, functionName, result: answer() } as never);
      },
    });
    const supplyOf = async (voucherChain: PassportVoucherChain, garden: Address = issuer) =>
      getPublicGardenPassport(CHAIN, garden, {
        now: NOW,
        reader: indexer({ VoucherCoreConfiguration: PINS }).reader,
        voucherChain,
      });

    // Ten of twenty are out of the reserve, and the pool holds all ten: nothing is with a holder.
    const blocks: bigint[] = [];
    const inPool = await supplyOf(chain(10n * VOUCHERS, blocks));
    expect(inPool.supply).toEqual({
      status: "available",
      asOf: 1_800_000,
      value: [
        {
          token: tsv.token.address.toLowerCase(),
          symbol: "TSV",
          decimals: 6,
          pools: [
            {
              name: "Green Goods",
              listed: true,
              holding: 10n * VOUCHERS,
              holdingLimit: 20n * VOUCHERS,
            },
          ],
          outstanding: 10n * VOUCHERS,
          outsidePools: false,
        },
      ],
    });
    // Every figure answers from the one block the reading was taken at.
    expect(new Set(blocks)).toEqual(new Set([77n]));

    // Two more left the reserve and are not in the pool. Outstanding minus the pool would be
    // what holders have, and nobody counted the holders: the total waits, the pool's figures stay.
    const withHolders = value((await supplyOf(chain(8n * VOUCHERS))).supply);
    expect(withHolders).toMatchObject([
      { outstanding: null, outsidePools: true, pools: [{ holding: 10n * VOUCHERS }] },
    ]);

    // A reserve larger than the supply is a reading that does not add up, not a figure.
    const broken = await supplyOf(chain(21n * VOUCHERS));
    expect(broken.supply).toEqual({ status: "unavailable" });
    expect(broken.unavailableSources).toMatchObject({ supply: true, promises: false });
    expect(broken.partialData).toBe(true);

    // A garden that issues no voucher asks the chain nothing.
    const silent: PassportVoucherChain = {
      block: async () => {
        throw new Error("the chain must not be read");
      },
      call: async () => "0x",
    };
    expect((await supplyOf(silent, GARDEN)).supply).toEqual({
      status: "available",
      asOf: null,
      value: [],
    });
  });
});
