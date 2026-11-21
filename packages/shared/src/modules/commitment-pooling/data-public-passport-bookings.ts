import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { integer, number, type RawRow } from "./data-core";
import { isRegisteredRehearsal, type PassportPromiseRow } from "./data-public-passport-promises";
import {
  passportRowTimes,
  readPassportRows,
  readPassportRowsByIds,
  readPassportRowsIn,
} from "./data-public-passport-reads";
import type { PassportVoucherModules } from "./data-public-passport-vouchers";
import {
  type PassportServiceLine,
  type PassportVoucherLine,
  type PassportVouchers,
  PUBLIC_PASSPORT_MIN_PEOPLE,
} from "./public-passport-types";

/** Setup result phases, as the escrow reports them. */
const PHASE = { deposited: 2, active: 3, abortRefundPending: 4, aborted: 5 } as const;
/** Final split transfer states. */
const LEG = { pending: 1, failed: 2, succeeded: 3 } as const;

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

/**
 * The promise behind each booking: its unit label, and whether it is a registered rehearsal.
 * A garden can provide a service offered in another pool, so promises outside its own pool are
 * read by id instead of being lumped together as unlabeled.
 */
async function promisesBehind(
  chainId: number,
  setups: readonly RawRow[],
  promises: readonly PassportPromiseRow[],
  rehearsalIds: ReadonlySet<bigint>,
  reader: GraphQLReader
) {
  const labels = new Map(promises.map((row) => [row.commitmentId, row.unitLabel]));
  const rehearsals = new Set(rehearsalIds);
  const elsewhere = [
    ...new Set(
      setups
        .map((setup) => integer(setup.commitmentId))
        .filter((id) => !labels.has(id) && !rehearsals.has(id))
    ),
  ];
  if (elsewhere.length > 0) {
    const rows = await readPassportRowsIn(
      reader,
      "Commitment",
      "id commitmentId poolId cycleId unitLabel",
      {
        chainId,
        field: "commitmentId",
        values: elsewhere,
        extra: "creationSeen: { _eq: true }",
      }
    );
    for (const row of rows) {
      const id = integer(row.commitmentId);
      if (isRegisteredRehearsal(chainId, row)) rehearsals.add(id);
      else
        labels.set(id, typeof row.unitLabel === "string" && row.unitLabel ? row.unitLabel : null);
    }
  }
  return { labels, rehearsals };
}

/**
 * Services booked with vouchers, for the garden that provides them. Presentment, the delivery the
 * holder approved and where the vouchers went afterwards are counted apart, and bookings against
 * a registered rehearsal stay out.
 */
export async function readPassportBookings(
  chainId: number,
  garden: Address,
  modules: PassportVoucherModules,
  promises: readonly PassportPromiseRow[],
  rehearsalIds: ReadonlySet<bigint>,
  reader: GraphQLReader
): Promise<{ bookings: PassportVouchers["bookings"]; changed: number[] }> {
  // Only the booking module the promise module pinned, acting for that promise module, counts.
  const indexed =
    modules.bookings === null
      ? []
      : await readPassportRows(
          reader,
          "VoucherServiceSetup",
          "id commitmentId holder token voucherUnits serviceUnits unitLabelHash latestSetupResultId latestFinalResultId updatedAt",
          "chainId: { _eq: $chainId }, moduleAddress: { _eq: $module }, coreModule: { _eq: $core }, providerGarden: { _eq: $garden }, authorizationSeen: { _eq: true }",
          {
            chainId,
            garden: garden.toLowerCase(),
            module: modules.bookings,
            core: modules.core.toLowerCase(),
          },
          "$chainId: Int!, $garden: String!, $module: String!, $core: String!"
        );
  const behind = await promisesBehind(chainId, indexed, promises, rehearsalIds, reader);
  const setups = indexed.filter((setup) => !behind.rehearsals.has(integer(setup.commitmentId)));
  const resultIds = (field: string) =>
    setups.flatMap((setup) => (typeof setup[field] === "string" ? [String(setup[field])] : []));
  const [setupResults, finalResults] = await Promise.all([
    readPassportRowsByIds(
      reader,
      "VoucherServiceSetupResult",
      "id phase depositedUnits setupRefundedUnits timestamp",
      resultIds("latestSetupResultId")
    ),
    readPassportRowsByIds(
      reader,
      "VoucherServiceFinalResult",
      "id approvedDeliveredServiceUnits releaseVoucherUnits refundVoucherUnits releaseState refundState timestamp",
      resultIds("latestFinalResultId")
    ),
  ]);
  const changed = [
    ...passportRowTimes(setups),
    ...passportRowTimes(setupResults),
    ...passportRowTimes(finalResults),
  ];
  const holderOf = (setup: RawRow) =>
    typeof setup.holder === "string" ? setup.holder.toLowerCase() : null;
  const people = new Set(setups.flatMap((setup) => holderOf(setup) ?? []));
  if (setups.length > 0 && people.size < PUBLIC_PASSPORT_MIN_PEOPLE) {
    return { bookings: { withheld: true }, changed };
  }

  const setupResultById = new Map(setupResults.map((row) => [String(row.id), row]));
  const finalResultById = new Map(finalResults.map((row) => [String(row.id), row]));
  const services = new Map<string, PassportServiceLine>();
  const vouchers = new Map<string, PassportVoucherLine>();
  // Distinct holders behind each published figure, read to apply the people floor and never
  // published. A line's holders are not the holders behind each of its figures: three people can
  // book a service while only one booking has settled.
  const holders = new Map<string, Set<string>>();
  const add = (setup: RawRow, cell: string, units: bigint) => {
    if (units <= 0n) return;
    const set = holders.get(cell) ?? new Set<string>();
    holders.set(cell, set);
    const holder = holderOf(setup);
    if (holder) set.add(holder);
  };
  let accepted = 0;
  let notStarted = 0;
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
    // A promise the index does not hold keeps its own line under its label's hash: service
    // units of unknown kinds are never one figure.
    const label = behind.labels.get(integer(setup.commitmentId)) ?? null;
    const lineKey = label === null ? `hash:${String(setup.unitLabelHash)}` : `label:${label}`;
    const service = services.get(lineKey) ?? {
      unitLabel: label,
      booked: 0n,
      confirmedDelivered: 0n,
    };
    services.set(lineKey, service);
    const countService = (figure: "booked" | "confirmedDelivered", units: bigint) => {
      service[figure] += units;
      add(setup, `${lineKey}:${figure}`, units);
    };
    const countVoucher = (
      figure: "presented" | "returnedToIssuer" | "refundedToHolder" | "awaitingTransfer",
      units: bigint
    ) => {
      voucher[figure] += units;
      add(setup, `${token}:${figure}`, units);
    };

    const result = setupResultById.get(String(setup.latestSetupResultId));
    const phase = result ? number(result.phase) : 0;
    const deposited = result ? integer(result.depositedUnits) : 0n;
    const setupRefunded = result ? integer(result.setupRefundedUnits) : 0n;
    const ended = phase === PHASE.abortRefundPending || phase === PHASE.aborted;
    if (phase === PHASE.active) accepted += 1;
    if (ended) notStarted += 1;
    else countService("booked", integer(setup.serviceUnits));
    if (phase >= PHASE.deposited) countVoucher("presented", deposited);
    countVoucher("refundedToHolder", setupRefunded);
    if (phase === PHASE.abortRefundPending) {
      countVoucher("awaitingTransfer", deposited - setupRefunded);
    }

    const final = finalResultById.get(String(setup.latestFinalResultId));
    // What the published figures leave over is a figure too: booked minus delivered, and
    // presented minus what has moved, are read off the totals. Each remainder needs its own
    // three holders, so it is counted here as an unpublished cell under the same floor.
    const approved = final ? integer(final.approvedDeliveredServiceUnits) : 0n;
    if (!ended) add(setup, `${lineKey}:undelivered`, integer(setup.serviceUnits) - approved);
    const assignedByFinal = final
      ? integer(final.releaseVoucherUnits) + integer(final.refundVoucherUnits)
      : 0n;
    if (phase >= PHASE.deposited && !ended) {
      add(setup, `${token}:inEscrow`, deposited - assignedByFinal);
    }
    if (!final) continue;
    settled += 1;
    countService("confirmedDelivered", integer(final.approvedDeliveredServiceUnits));
    const legs = [
      {
        units: integer(final.releaseVoucherUnits),
        state: number(final.releaseState),
        to: "returnedToIssuer",
      },
      {
        units: integer(final.refundVoucherUnits),
        state: number(final.refundState),
        to: "refundedToHolder",
      },
    ] as const;
    for (const leg of legs) {
      if (leg.state === LEG.succeeded) {
        countVoucher(leg.to, leg.units);
      } else if (leg.state === LEG.pending || leg.state === LEG.failed) {
        countVoucher("awaitingTransfer", leg.units);
        if (leg.state === LEG.failed) transfersFailed += 1;
      }
    }
  }
  await nameVoucherAssets([...vouchers.values()]);
  // Three holders overall is not three behind each figure: one settled booking would publish
  // one person's delivered units. The unit figures wait until every one of them clears it.
  const everyLineCovered = [...holders.values()].every(
    (set) => set.size >= PUBLIC_PASSPORT_MIN_PEOPLE
  );
  return {
    changed,
    bookings: {
      withheld: false,
      requested: setups.length,
      accepted,
      notStarted,
      settled,
      transfersFailed,
      amounts: everyLineCovered
        ? {
            services: [...services.values()].sort((left, right) =>
              (left.unitLabel ?? "").localeCompare(right.unitLabel ?? "")
            ),
            vouchers: [...vouchers.values()].sort((left, right) =>
              left.token.localeCompare(right.token)
            ),
          }
        : null,
    },
  };
}
