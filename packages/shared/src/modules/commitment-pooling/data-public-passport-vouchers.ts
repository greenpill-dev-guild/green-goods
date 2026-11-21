import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { integer, number, type RawRow } from "./data-core";
import {
  isStandingOffer,
  type PassportPromiseRow,
  readPassportRows,
} from "./data-public-passport-promises";
import {
  type PassportServiceLine,
  type PassportVoucherLine,
  type PassportVouchers,
  PUBLIC_PASSPORT_MIN_PEOPLE,
} from "./public-passport-types";

const ID_CHUNK = 200;
/** `ServiceOfferRevision.paymentRoute`: the offer takes a voucher. */
const VOUCHER_PAYMENT_ROUTE = 2;
/** Setup result phases, as the escrow reports them. */
const PHASE = { deposited: 2, active: 3, abortRefundPending: 4, aborted: 5 } as const;
/** Final split transfer states. */
const LEG = { pending: 1, failed: 2, succeeded: 3 } as const;

function chunks<T>(values: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += ID_CHUNK) {
    out.push(values.slice(index, index + ID_CHUNK));
  }
  return out;
}

async function readByCommitments(
  reader: GraphQLReader,
  entity: string,
  fields: string,
  chainId: number,
  commitmentIds: readonly bigint[],
  extra = ""
): Promise<RawRow[]> {
  const pages = await Promise.all(
    chunks(commitmentIds.map((id) => id.toString())).map((ids) =>
      readPassportRows(
        reader,
        entity,
        fields,
        `chainId: { _eq: $chainId }, commitmentId: { _in: $ids }${extra}`,
        { chainId, ids },
        "$chainId: Int!, $ids: [numeric!]!"
      )
    )
  );
  return pages.flat();
}

async function readByIds(
  reader: GraphQLReader,
  entity: string,
  fields: string,
  ids: readonly string[]
): Promise<RawRow[]> {
  const pages = await Promise.all(
    chunks(ids).map((chunk) =>
      readPassportRows(
        reader,
        entity,
        fields,
        "id: { _in: $ids }",
        { ids: chunk },
        "$ids: [String!]!"
      )
    )
  );
  return pages.flat();
}

function latestPerCommitment(rows: readonly RawRow[]): Map<bigint, RawRow> {
  const latest = new Map<bigint, RawRow>();
  for (const row of rows) {
    const commitmentId = integer(row.commitmentId);
    const current = latest.get(commitmentId);
    if (!current || integer(row.revision) > integer(current.revision)) {
      latest.set(commitmentId, row);
    }
  }
  return latest;
}

const changedAt = (rows: readonly RawRow[]) =>
  rows.flatMap((row) =>
    typeof row.updatedAt === "number"
      ? [row.updatedAt]
      : typeof row.timestamp === "number"
        ? [row.timestamp]
        : []
  );

async function readEarned(
  chainId: number,
  promises: readonly PassportPromiseRow[],
  reader: GraphQLReader
): Promise<{ earned: PassportVouchers["earned"]; changed: number[] }> {
  const taken = promises.filter((row) => row.takenUp);
  const ids = taken.map((row) => row.commitmentId);
  const [terms, awards] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          readByCommitments(
            reader,
            "EarnedVoucherTerms",
            "id commitmentId revision approvedSeen updatedAt",
            chainId,
            ids
          ),
          readByCommitments(
            reader,
            "EarnedVoucherDistribution",
            "id entitlementId commitmentId delivered updatedAt",
            chainId,
            ids,
            ", preparedSeen: { _eq: true }"
          ),
        ]);
  const byId = new Map(taken.map((row) => [row.commitmentId, row]));
  const people = new Set<string>();
  for (const award of awards) {
    const provider = byId.get(integer(award.commitmentId))?.provider;
    if (provider) people.add(provider);
  }
  const changed = [...changedAt(terms), ...changedAt(awards)];
  // No award is a publishable zero; one or two people's awards are not.
  if (awards.length > 0 && people.size < PUBLIC_PASSPORT_MIN_PEOPLE) {
    return { earned: { withheld: true }, changed };
  }
  const issued = awards.filter((award) => award.delivered === true);
  const traced = issued.flatMap((award) => {
    const promise = byId.get(integer(award.commitmentId));
    return promise?.kept ? [promise] : [];
  });
  return {
    changed,
    earned: {
      withheld: false,
      promisesWithApprovedTerms: [...latestPerCommitment(terms).values()].filter(
        (row) => row.approvedSeen === true
      ).length,
      recorded: awards.length,
      issued: issued.length,
      failed: awards.filter((award) => award.delivered === false).length,
      awaiting: awards.filter((award) => typeof award.delivered !== "boolean").length,
      tracedToKeptPromise: traced.length,
      confirmedByOwnConfirmers: traced.filter((row) => row.confirmationPath === "ORDINARY").length,
      confirmedByFallback: traced.filter(
        (row) => row.confirmationPath !== null && row.confirmationPath !== "ORDINARY"
      ).length,
    },
  };
}

/**
 * Names each voucher from the reviewed issuer list. The list is loaded only when a booking
 * exists, so pages that read a passport with none do not carry the issuer configuration.
 */
async function nameVoucherAssets(lines: PassportVoucherLine[]): Promise<void> {
  if (lines.length === 0) return;
  const { GREEN_GOODS_ISSUER_ROUTE } = await import("./service-issuer-live-config");
  for (const line of lines) {
    const asset = GREEN_GOODS_ISSUER_ROUTE.assets.find(
      (entry) => entry.token.address.toLowerCase() === line.token
    );
    if (!asset) continue;
    line.symbol = asset.symbol;
    line.decimals = asset.decimals;
  }
}

async function readBookings(
  chainId: number,
  garden: Address,
  promises: readonly PassportPromiseRow[],
  reader: GraphQLReader
): Promise<{ bookings: PassportVouchers["bookings"]; changed: number[] }> {
  const setups = await readPassportRows(
    reader,
    "VoucherServiceSetup",
    "id commitmentId holder token voucherUnits serviceUnits latestSetupResultId latestFinalResultId updatedAt",
    "chainId: { _eq: $chainId }, providerGarden: { _eq: $garden }, authorizationSeen: { _eq: true }",
    { chainId, garden: garden.toLowerCase() },
    "$chainId: Int!, $garden: String!"
  );
  const resultIds = (field: string) =>
    setups.flatMap((setup) => (typeof setup[field] === "string" ? [String(setup[field])] : []));
  const [setupResults, finalResults] = await Promise.all([
    readByIds(
      reader,
      "VoucherServiceSetupResult",
      "id phase depositedUnits setupRefundedUnits timestamp",
      resultIds("latestSetupResultId")
    ),
    readByIds(
      reader,
      "VoucherServiceFinalResult",
      "id approvedDeliveredServiceUnits releaseVoucherUnits refundVoucherUnits releaseState refundState timestamp",
      resultIds("latestFinalResultId")
    ),
  ]);
  const changed = [...changedAt(setups), ...changedAt(setupResults), ...changedAt(finalResults)];
  const people = new Set<string>();
  for (const setup of setups) {
    if (typeof setup.holder === "string") people.add(setup.holder.toLowerCase());
  }
  if (setups.length > 0 && people.size < PUBLIC_PASSPORT_MIN_PEOPLE) {
    return { bookings: { withheld: true }, changed };
  }

  const setupResultById = new Map(setupResults.map((row) => [String(row.id), row]));
  const finalResultById = new Map(finalResults.map((row) => [String(row.id), row]));
  const labelByCommitment = new Map(promises.map((row) => [row.commitmentId, row.unitLabel]));
  const services = new Map<string | null, PassportServiceLine>();
  const vouchers = new Map<string, PassportVoucherLine>();
  let accepted = 0;
  let declined = 0;
  let settled = 0;
  let transfersFailed = 0;
  for (const setup of setups) {
    if (typeof setup.token !== "string") throw new Error("Voucher booking has no voucher asset");
    const token = setup.token.toLowerCase() as Address;
    const voucher = vouchers.get(token) ?? {
      token,
      symbol: null,
      decimals: null,
      presented: 0n,
      returnedToIssuer: 0n,
      refundedToHolder: 0n,
      awaitingTransfer: 0n,
    };
    vouchers.set(token, voucher);
    const label = labelByCommitment.get(integer(setup.commitmentId)) ?? null;
    const service = services.get(label) ?? { unitLabel: label, booked: 0n, confirmedDelivered: 0n };
    services.set(label, service);

    const result = setupResultById.get(String(setup.latestSetupResultId));
    const phase = result ? number(result.phase) : 0;
    const deposited = result ? integer(result.depositedUnits) : 0n;
    const setupRefunded = result ? integer(result.setupRefundedUnits) : 0n;
    const wasDeclined = phase === PHASE.abortRefundPending || phase === PHASE.aborted;
    if (phase === PHASE.active) accepted += 1;
    if (wasDeclined) declined += 1;
    else service.booked += integer(setup.serviceUnits);
    if (phase >= PHASE.deposited) voucher.presented += deposited;
    voucher.refundedToHolder += setupRefunded;
    if (phase === PHASE.abortRefundPending) voucher.awaitingTransfer += deposited - setupRefunded;

    const final = finalResultById.get(String(setup.latestFinalResultId));
    if (!final) continue;
    settled += 1;
    service.confirmedDelivered += integer(final.approvedDeliveredServiceUnits);
    const legs = [
      {
        units: integer(final.releaseVoucherUnits),
        state: number(final.releaseState),
        to: "issuer",
      },
      { units: integer(final.refundVoucherUnits), state: number(final.refundState), to: "holder" },
    ] as const;
    for (const leg of legs) {
      if (leg.state === LEG.succeeded) {
        if (leg.to === "issuer") voucher.returnedToIssuer += leg.units;
        else voucher.refundedToHolder += leg.units;
      } else if (leg.state === LEG.pending || leg.state === LEG.failed) {
        voucher.awaitingTransfer += leg.units;
        if (leg.state === LEG.failed) transfersFailed += 1;
      }
    }
  }
  await nameVoucherAssets([...vouchers.values()]);
  return {
    changed,
    bookings: {
      withheld: false,
      requested: setups.length,
      accepted,
      declined,
      settled,
      transfersFailed,
      services: [...services.values()].sort((left, right) =>
        (left.unitLabel ?? "").localeCompare(right.unitLabel ?? "")
      ),
      vouchers: [...vouchers.values()].sort((left, right) => left.token.localeCompare(right.token)),
    },
  };
}

/** Voucher evidence for one garden: what is on offer, what was earned, what was booked. */
export async function readPassportVouchers(
  chainId: number,
  garden: Address,
  promises: readonly PassportPromiseRow[],
  now: number,
  reader: GraphQLReader
): Promise<{ vouchers: PassportVouchers; asOf: number | null }> {
  const standing = promises.filter((row) => isStandingOffer(row, now));
  const [revisions, earned, bookings] = await Promise.all([
    standing.length === 0
      ? Promise.resolve([])
      : readByCommitments(
          reader,
          "ServiceOfferRevision",
          "id commitmentId revision paymentRoute timestamp",
          chainId,
          standing.map((row) => row.commitmentId)
        ),
    readEarned(chainId, promises, reader),
    readBookings(chainId, garden, promises, reader),
  ]);
  const latest = latestPerCommitment(revisions);
  const bookable = standing.filter(
    (row) => number(latest.get(row.commitmentId)?.paymentRoute) === VOUCHER_PAYMENT_ROUTE
  );
  const capacity = new Map<string, bigint>();
  for (const row of bookable) {
    if (row.unitLabel) {
      capacity.set(row.unitLabel, (capacity.get(row.unitLabel) ?? 0n) + row.targetUnits);
    }
  }
  const changed = [...changedAt(revisions), ...earned.changed, ...bookings.changed];
  return {
    asOf: changed.length === 0 ? null : Math.max(...changed),
    vouchers: {
      offersBookable: bookable.length,
      capacityOnOffer: [...capacity.entries()]
        .map(([unitLabel, units]) => ({ unitLabel, units }))
        .sort((left, right) => left.unitLabel.localeCompare(right.unitLabel)),
      earned: earned.earned,
      bookings: bookings.bookings,
    },
  };
}
