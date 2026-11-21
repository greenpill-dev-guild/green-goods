import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { integer, number, type RawRow } from "./data-core";
import { readPassportBookings } from "./data-public-passport-bookings";
import { isStandingOffer, type PassportPromiseRow } from "./data-public-passport-promises";
import { passportRowTimes, readPassportRowsByCommitments } from "./data-public-passport-reads";
import { type PassportVouchers, PUBLIC_PASSPORT_MIN_PEOPLE } from "./public-passport-types";

/** `ServiceOfferRevision.paymentRoute`: the offer takes a voucher. */
const VOUCHER_PAYMENT_ROUTE = 2;

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
  promises: readonly PassportPromiseRow[],
  reader: GraphQLReader
): Promise<{ earned: PassportVouchers["earned"]; changed: number[] }> {
  const taken = promises.filter((row) => row.takenUp);
  const ids = taken.map((row) => row.commitmentId);
  const [terms, awards] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          readPassportRowsByCommitments(
            reader,
            "EarnedVoucherTerms",
            "id commitmentId revision approvedSeen updatedAt",
            chainId,
            ids
          ),
          readPassportRowsByCommitments(
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
  const changed = [...passportRowTimes(terms), ...passportRowTimes(awards)];
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
  promises: readonly PassportPromiseRow[],
  rehearsalIds: ReadonlySet<bigint>,
  now: number,
  reader: GraphQLReader
): Promise<{ vouchers: PassportVouchers; asOf: number | null }> {
  const standing = promises.filter((row) => isStandingOffer(row, now));
  const [revisions, earned, bookings] = await Promise.all([
    standing.length === 0
      ? Promise.resolve([])
      : readPassportRowsByCommitments(
          reader,
          "ServiceOfferRevision",
          "id commitmentId revision paymentRoute timestamp",
          chainId,
          standing.map((row) => row.commitmentId)
        ),
    readEarned(chainId, promises, reader),
    readPassportBookings(chainId, garden, promises, rehearsalIds, reader),
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
  const changed = [...passportRowTimes(revisions), ...earned.changed, ...bookings.changed];
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
