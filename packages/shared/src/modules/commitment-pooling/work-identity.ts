import { isHex, type Hex } from "viem";
import { getWorksByGardener } from "../data/eas";
import { getJsonByHash } from "../data/ipfs/resolve";
import type { Address } from "../../types/domain";

export type DeferredWorkIdentityResolution =
  | { status: "waiting" }
  | { status: "retryable"; reason: "work-metadata-unavailable" }
  | { status: "resolved"; workUID: Hex }
  | { status: "conflict"; reason: "work-identity-conflict" };

export interface ResolveDeferredWorkIdentityDependencies {
  getWorksByGardener: typeof getWorksByGardener;
  readMetadata: (raw: string) => Promise<unknown>;
}

async function defaultReadMetadata(raw: string): Promise<unknown> {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") parsed = JSON.parse(parsed) as unknown;
    return parsed;
  }
  return getJsonByHash(trimmed);
}

function clientIdOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const clientWorkId = (value as Record<string, unknown>).clientWorkId;
  return typeof clientWorkId === "string" ? clientWorkId : null;
}

/** Exact client id + chain query + caller + garden resolution for a deferred link. */
export async function resolveDeferredWorkIdentity(input: {
  clientWorkId: string;
  chainId: number;
  garden: Address;
  caller: Address;
  dependencies?: Partial<ResolveDeferredWorkIdentityDependencies>;
}): Promise<DeferredWorkIdentityResolution> {
  const getWorks = input.dependencies?.getWorksByGardener ?? getWorksByGardener;
  const readMetadata = input.dependencies?.readMetadata ?? defaultReadMetadata;
  const works = await getWorks(input.caller, input.chainId);
  let metadataFailures = 0;
  const candidates = (
    await Promise.all(
      works.map(async (work) => {
        try {
          return clientIdOf(await readMetadata(work.metadata)) === input.clientWorkId ? work : null;
        } catch {
          metadataFailures += 1;
          return null;
        }
      })
    )
  ).filter((work): work is NonNullable<typeof work> => work !== null);
  if (candidates.length === 0) {
    return metadataFailures > 0
      ? { status: "retryable", reason: "work-metadata-unavailable" }
      : { status: "waiting" };
  }
  // A failed metadata read can conceal a duplicate identity. Never resolve an
  // identity until every indexed candidate has been inspected successfully.
  if (metadataFailures > 0) {
    return { status: "retryable", reason: "work-metadata-unavailable" };
  }
  if (
    candidates.length !== 1 ||
    candidates[0].gardenAddress.toLowerCase() !== input.garden.toLowerCase() ||
    !isHex(candidates[0].id, { strict: true }) ||
    candidates[0].id.length !== 66
  ) {
    return { status: "conflict", reason: "work-identity-conflict" };
  }
  return { status: "resolved", workUID: candidates[0].id as Hex };
}
