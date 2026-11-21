import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { type GraphQLReader, greenGoodsIndexer } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";
import {
  readPassportPromiseRows,
  summarizePassportPromises,
} from "./data-public-passport-promises";
import { readPassportSettlement } from "./data-public-passport-settlement";
import { readPassportVouchers } from "./data-public-passport-vouchers";
import type { PassportSection, PublicGardenPassportRecord } from "./public-passport-types";

export interface PublicGardenPassportReadOptions {
  /** The moment the read is taken at, in seconds. Offers past their term stop counting as open. */
  now?: number;
  reader?: GraphQLReader;
}

const UNAVAILABLE = { status: "unavailable" } as const;

async function section<T>(
  source: string,
  garden: Address,
  read: () => Promise<{ value: T; asOf: number | null }>
): Promise<PassportSection<T>> {
  try {
    return { status: "available", ...(await read()) };
  } catch (error) {
    logger.warn("[getPublicGardenPassport] passport source is unavailable", {
      source,
      garden,
      error,
    });
    return UNAVAILABLE;
  }
}

/**
 * One garden's passport, read from the indexer alone. Promises come first: vouchers and payments
 * are joined to them, so a failed promise read leaves both unavailable instead of unjoined.
 * A failed pool lookup throws: it is not the same as a garden with no pool.
 */
export async function getPublicGardenPassport(
  chainId: number,
  garden: Address,
  options: PublicGardenPassportReadOptions = {}
): Promise<PublicGardenPassportRecord> {
  const reader = options.reader ?? greenGoodsIndexer;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const pool = await reader.query<Record<string, RawRow[]>>(
    `query PublicPassportPool($chainId: Int!, $garden: String!) {
      CommitmentPool(where: { chainId: { _eq: $chainId }, garden: { _eq: $garden }, registrationSeen: { _eq: true } }, limit: 1) { id poolId }
    }`,
    { chainId, garden: garden.toLowerCase() },
    "getPublicPassportPool"
  );
  if (pool.error) throw pool.error;
  if (!Array.isArray(pool.data?.CommitmentPool)) throw new Error("Passport pool is unavailable");
  const poolRow = pool.data.CommitmentPool[0];
  const poolId = poolRow ? integer(poolRow.poolId) : null;

  const promiseRead = await section("promises", garden, async () => {
    const { rows, rehearsalIds } =
      poolId === null
        ? { rows: [], rehearsalIds: new Set<bigint>() }
        : await readPassportPromiseRows(chainId, poolId, reader);
    const { promises, asOf } = summarizePassportPromises(rows, now);
    return { value: { promises, rows, rehearsalIds }, asOf };
  });

  let vouchers: PublicGardenPassportRecord["vouchers"] = UNAVAILABLE;
  let settlement: PublicGardenPassportRecord["settlement"] = UNAVAILABLE;
  if (promiseRead.status === "available") {
    const { rows, rehearsalIds } = promiseRead.value;
    [vouchers, settlement] = await Promise.all([
      section("vouchers", garden, async () => {
        const read = await readPassportVouchers(chainId, garden, rows, now, reader);
        return { value: read.vouchers, asOf: read.asOf };
      }),
      section("settlement", garden, async () => {
        const read = await readPassportSettlement(chainId, garden, rehearsalIds, reader);
        return { value: read.settlement, asOf: read.asOf };
      }),
    ]);
  }

  const unavailableSources = {
    promises: promiseRead.status === "unavailable",
    vouchers: vouchers.status === "unavailable",
    settlement: settlement.status === "unavailable",
  };
  return {
    chainId,
    garden: garden.toLowerCase() as Address,
    poolId,
    readAt: now,
    promises:
      promiseRead.status === "available"
        ? { status: "available", asOf: promiseRead.asOf, value: promiseRead.value.promises }
        : UNAVAILABLE,
    vouchers,
    settlement,
    partialData: Object.values(unavailableSources).some(Boolean),
    unavailableSources,
  };
}
