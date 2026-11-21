import type { GraphQLReader } from "../data/graphql-client";
import type { RawRow } from "./data-core";

const PAGE_SIZE = 100;
/** A record past this many rows needs a paged passport, not a longer wait. */
const ROW_LIMIT = 2000;
const ID_CHUNK = 200;

/**
 * Keyset pages over one indexed entity. A read that cannot finish inside its limit fails, because
 * a passport figure computed from part of a record would be published as the whole.
 *
 * `idFilter` joins the page cursor inside the one `id` comparison (`_in: $ids, `): a `where` with
 * two `id` keys is not valid GraphQL.
 */
export async function readPassportRows(
  reader: GraphQLReader,
  entity: string,
  fields: string,
  where: string,
  variables: Record<string, unknown>,
  declarations: string,
  idFilter = ""
): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  const deadline = AbortSignal.timeout(30000);
  const scope = where === "" ? "" : `${where}, `;
  let after = "";
  while (true) {
    deadline.throwIfAborted();
    const result = await reader.query<Record<string, RawRow[]>>(
      `query PublicPassport${entity}(${declarations}, $after: String!) {
        ${entity}(where: { ${scope}id: { ${idFilter}_gt: $after } }, order_by: { id: asc }, limit: ${PAGE_SIZE}) { ${fields} }
      }`,
      { ...variables, after },
      `getPublicPassport${entity}`
    );
    if (result.error) throw result.error;
    const page = result.data?.[entity];
    if (!Array.isArray(page)) throw new Error(`Passport ${entity} records are unavailable`);
    for (const row of page) {
      if (typeof row.id !== "string" || row.id <= after) {
        throw new Error(`Passport ${entity} records did not advance`);
      }
      after = row.id;
      rows.push(row);
    }
    if (rows.length > ROW_LIMIT)
      throw new Error(`Passport ${entity} history exceeds its read limit`);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function chunks<T>(values: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += ID_CHUNK) {
    out.push(values.slice(index, index + ID_CHUNK));
  }
  return out;
}

/** Rows of one entity that belong to the named promises. */
export async function readPassportRowsByCommitments(
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

/** Rows of one entity by their own ids. */
export async function readPassportRowsByIds(
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
        "",
        { ids: chunk },
        "$ids: [String!]!",
        "_in: $ids, "
      )
    )
  );
  return pages.flat();
}

/** When each row last changed, for a section's freshness. */
export function passportRowTimes(rows: readonly RawRow[]): number[] {
  return rows.flatMap((row) =>
    typeof row.updatedAt === "number"
      ? [row.updatedAt]
      : typeof row.timestamp === "number"
        ? [row.timestamp]
        : []
  );
}
