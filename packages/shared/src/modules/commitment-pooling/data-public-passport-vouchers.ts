import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { integer, number, type RawRow } from "./data-core";
import { readPassportBookings } from "./data-public-passport-bookings";
import { isStandingOffer, type PassportPromiseRow } from "./data-public-passport-promises";
import {
  passportRowTimes,
  readPassportRowsByIds,
  readPassportRowsIn,
} from "./data-public-passport-reads";
import { type PassportVouchers, PUBLIC_PASSPORT_MIN_PEOPLE } from "./public-passport-types";

/** `ServiceOfferRevision.paymentRoute`: the offer takes a voucher. */
const VOUCHER_PAYMENT_ROUTE = 2;

/**
 * The modules whose voucher records count: the deployed promise module, and the earned-voucher
 * and booking modules it pinned. The indexer keys voucher records by chain and emitting module,
 * so records from any other module are never joined to this garden's promises.
 */
export interface PassportVoucherModules {
  core: Address;
  /** Null until the promise module pins one: no award can count before then. */
  earned: Address | null;
  /** Null until the promise module pins one: no booking can count before then. */
  bookings: Address | null;
}

async function readVoucherModules(
  chainId: number,
  core: Address,
  reader: GraphQLReader
): Promise<PassportVoucherModules> {
  const [pins] = await readPassportRowsByIds(
    reader,
    "VoucherCoreConfiguration",
    "id earnedModule serviceSetupModule earnedPinSeen servicePinSeen",
    [`${chainId}-${core.toLowerCase()}`]
  );
  const pinned = (seen: unknown, module: unknown) =>
    seen === true && typeof module === "string" && /^0x[0-9a-f]{40}$/i.test(module)
      ? (module.toLowerCase() as Address)
      : null;
  return {
    core,
    earned: pinned(pins?.earnedPinSeen, pins?.earnedModule),
    bookings: pinned(pins?.servicePinSeen, pins?.serviceSetupModule),
  };
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

async function readEarned(
  chainId: number,
  module: Address | null,
  promises: readonly PassportPromiseRow[],
  reader: GraphQLReader
): Promise<{ earned: PassportVouchers["earned"]; changed: number[] }> {
  const taken = promises.filter((row) => row.takenUp);
  const scope = {
    chainId,
    field: "commitmentId" as const,
    values: taken.map((row) => row.commitmentId),
    module: module ?? undefined,
  };
  const [terms, awards] =
    taken.length === 0 || module === null
      ? [[], []]
      : await Promise.all([
          readPassportRowsIn(
            reader,
            "EarnedVoucherTerms",
            "id commitmentId revision approvedSeen updatedAt",
            scope
          ),
          readPassportRowsIn(
            reader,
            "EarnedVoucherDistribution",
            "id entitlementId commitmentId delivered updatedAt",
            { ...scope, extra: "preparedSeen: { _eq: true }" }
          ),
        ]);
  const byId = new Map(taken.map((row) => [row.commitmentId, row]));
  const awarded = awards.flatMap((award) => byId.get(integer(award.commitmentId)) ?? []);
  const people = new Set(awarded.flatMap((promise) => promise.provider ?? []));
  // The promises behind the awards decide what is traced, so their changes date the figures too.
  const changed = [
    ...passportRowTimes(terms),
    ...passportRowTimes(awards),
    ...awarded.map((promise) => promise.updatedAt),
  ];
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

/** Voucher evidence for one garden: what is on offer, what was earned, what was booked. */
export async function readPassportVouchers(
  chainId: number,
  garden: Address,
  core: Address,
  promises: readonly PassportPromiseRow[],
  rehearsalIds: ReadonlySet<bigint>,
  now: number,
  reader: GraphQLReader
): Promise<{ vouchers: PassportVouchers; asOf: number | null }> {
  const modules = await readVoucherModules(chainId, core, reader);
  const standing = promises.filter((row) => isStandingOffer(row, now));
  const [revisions, earned, bookings] = await Promise.all([
    standing.length === 0
      ? Promise.resolve([])
      : readPassportRowsIn(
          reader,
          "ServiceOfferRevision",
          "id commitmentId revision paymentRoute timestamp",
          {
            chainId,
            field: "commitmentId",
            values: standing.map((row) => row.commitmentId),
            module: modules.core,
          }
        ),
    readEarned(chainId, modules.earned, promises, reader),
    readPassportBookings(chainId, garden, modules, promises, rehearsalIds, reader),
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
  // An offer leaves this figure when it is taken up or its term ends, so its own change counts.
  const changed = [
    ...passportRowTimes(revisions),
    ...bookable.map((row) => row.updatedAt),
    ...earned.changed,
    ...bookings.changed,
  ];
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
