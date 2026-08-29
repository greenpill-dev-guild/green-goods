import { isPublicGardenImpactChainSupported } from "../../config/blockchain";
import type { PublicGardenImpactSource } from "../../public-contracts/garden-impact";
import { isZeroBytes32 } from "../../utils/blockchain/vaults";
import type { GraphQLReader } from "./graphql-client";

export const PUBLIC_GARDEN_IMPACT_SOURCE_PAGE_SIZE = 100;
export const PUBLIC_GARDEN_IMPACT_SOURCE_LIMIT = 1_000;

export type PublicGardenImpactSourceFailureReason =
  | "missing_schema"
  | "provider_failed"
  | "limit_exceeded"
  | "unsupported_chain";

export class PublicGardenImpactSourceError extends Error {
  constructor(
    public readonly source: PublicGardenImpactSource,
    public readonly reason: PublicGardenImpactSourceFailureReason,
    public readonly cause?: unknown
  ) {
    super(`Public garden impact ${source} source is unavailable`);
    this.name = "PublicGardenImpactSourceError";
  }
}

export async function readPublicGardenImpactPages<T>(
  source: PublicGardenImpactSource,
  readPage: (limit: number, offset: number) => Promise<T[]>
): Promise<T[]> {
  const records: T[] = [];
  for (
    let offset = 0;
    offset <= PUBLIC_GARDEN_IMPACT_SOURCE_LIMIT;
    offset += PUBLIC_GARDEN_IMPACT_SOURCE_PAGE_SIZE
  ) {
    const limit =
      offset === PUBLIC_GARDEN_IMPACT_SOURCE_LIMIT ? 1 : PUBLIC_GARDEN_IMPACT_SOURCE_PAGE_SIZE;
    const page = await readPage(limit, offset);
    if (offset === PUBLIC_GARDEN_IMPACT_SOURCE_LIMIT) {
      if (page.length > 0) throw new PublicGardenImpactSourceError(source, "limit_exceeded");
      break;
    }
    records.push(...page);
    if (page.length < limit) break;
  }
  return records;
}

export function assertPublicGardenImpactChain(
  chainId: number,
  source: PublicGardenImpactSource
): void {
  if (!isPublicGardenImpactChainSupported(chainId)) {
    throw new PublicGardenImpactSourceError(source, "unsupported_chain");
  }
}

export function requirePublicGardenImpactSchema(
  source: PublicGardenImpactSource,
  uid: string
): string {
  if (isZeroBytes32(uid)) throw new PublicGardenImpactSourceError(source, "missing_schema");
  return uid;
}

export function wrapPublicGardenImpactSourceError(
  source: PublicGardenImpactSource,
  error: unknown
): PublicGardenImpactSourceError {
  return error instanceof PublicGardenImpactSourceError
    ? error
    : new PublicGardenImpactSourceError(source, "provider_failed", error);
}

export async function queryPublicGardenImpactRows<T>(input: {
  reader: GraphQLReader;
  document: string;
  variables: Record<string, unknown>;
  operationName: string;
  field: string;
  source: PublicGardenImpactSource;
}): Promise<T[]> {
  const result = await input.reader.query<Record<string, unknown>>(
    input.document,
    input.variables,
    input.operationName
  );
  if (result.error) {
    throw new PublicGardenImpactSourceError(input.source, "provider_failed", result.error);
  }
  const rows = result.data[input.field];
  if (!Array.isArray(rows)) {
    throw new PublicGardenImpactSourceError(input.source, "provider_failed");
  }
  return rows as T[];
}
