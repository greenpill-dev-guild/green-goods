import { isAddress, zeroAddress } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import {
  createPublicReportingRead,
  type PublicReportingRead,
} from "../commitment-pooling/public-record-exclusions";
import { parseDataToWorkApproval, parseEasAttestationRecord } from "./eas-parse";
import { easStoredAddress } from "./eas-read-validation";
import { createEasClient, greenGoodsIndexer, type GraphQLReader } from "./graphql-client";

export type GardenMemberContribution =
  | { status: "recorded"; at: number }
  | { status: "none" | "unavailable" | "loading" };
interface Scope {
  garden: Address;
  accounts: readonly Address[];
  chainId: number;
}
interface Readers {
  eas: GraphQLReader;
  indexer: GraphQLReader;
  reporting: Pick<PublicReportingRead, "links">;
}
type Row = Record<string, unknown>;
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const uidPattern = /^0x[\da-f]{64}$/i;
const same = (a: unknown, b: string) =>
  typeof a === "string" && a.toLowerCase() === b.toLowerCase();
function timestamp(value: unknown): number {
  const seconds = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (
    typeof seconds !== "number" ||
    !Number.isSafeInteger(seconds) ||
    seconds <= 0 ||
    seconds > 8_640_000_000_000
  )
    throw new Error("Invalid contribution timestamp");
  return seconds * 1000;
}
async function rows(
  reader: GraphQLReader,
  query: string,
  variables: Record<string, unknown>,
  field: string,
  operation: string,
  signal?: AbortSignal
): Promise<Row[]> {
  const result = await reader.query<Record<string, unknown>>(query, variables, operation, signal);
  if (result.error) throw result.error;
  const page = result.data?.[field];
  if (
    !Array.isArray(page) ||
    page.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  )
    throw new Error("Contribution records unavailable");
  return page as Row[];
}

async function latestEas(
  scope: Scope,
  account: Address,
  reader: GraphQLReader,
  excluded: Set<string>,
  signal?: AbortSignal
) {
  const config = getEASConfig(scope.chainId);
  if (
    !uidPattern.test(config.WORK.uid) ||
    /^0x0+$/.test(config.WORK.uid) ||
    /^0x0+$/.test(config.WORK_APPROVAL.uid)
  )
    throw new Error("Contribution schemas unavailable");
  const filter = {
    recipient: { equals: easStoredAddress(scope.garden) },
    attester: { equals: easStoredAddress(account) },
    revoked: { equals: false },
  };
  const query = `query MemberContributions($works: AttestationWhereInput!, $reviews: AttestationWhereInput!, $skip: Int!) {
    works: attestations(where: $works, orderBy: [{ timeCreated: desc }, { id: asc }], take: 1) { id attester recipient timeCreated decodedDataJson schemaId revoked }
    reviews: attestations(where: $reviews, orderBy: [{ timeCreated: desc }, { id: asc }], take: 50, skip: $skip) { id attester recipient timeCreated decodedDataJson schemaId revoked }
  }`;
  let latest = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await reader.query<{ works?: unknown[]; reviews?: unknown[] }>(
      query,
      {
        works: { ...filter, schemaId: { equals: config.WORK.uid }, id: { notIn: [...excluded] } },
        reviews: { ...filter, schemaId: { equals: config.WORK_APPROVAL.uid } },
        skip: page * PAGE_SIZE,
      },
      "getMemberContributions",
      signal
    );
    if (result.error) throw result.error;
    if (
      !Array.isArray(result.data?.works) ||
      !Array.isArray(result.data?.reviews) ||
      result.data.works.length > 1 ||
      result.data.reviews.length > PAGE_SIZE
    )
      throw new Error("Contribution attestations unavailable");
    const parse = (value: unknown, schema: string) => {
      const row = parseEasAttestationRecord(value);
      if (
        !uidPattern.test(row.id) ||
        row.revoked !== false ||
        !same(row.schemaId, schema) ||
        !same(row.attester, account) ||
        !same(row.recipient, scope.garden)
      )
        throw new Error("Contribution attestation outside scope");
      return { row, at: timestamp(row.timeCreated) };
    };
    if (page === 0 && result.data.works[0]) {
      const { row, at } = parse(result.data.works[0], config.WORK.uid);
      if (excluded.has(row.id.toLowerCase())) throw new Error("Excluded contribution returned");
      latest = at;
    }
    let previous = Infinity;
    for (const value of result.data.reviews) {
      const { row, at } = parse(value, config.WORK_APPROVAL.uid);
      if (at > previous) throw new Error("Unordered contribution reviews");
      previous = at;
      const review = parseDataToWorkApproval(
        row.id,
        { attester: row.attester, recipient: row.recipient, time: Number(row.timeCreated) },
        row.decodedDataJson
      );
      if (!uidPattern.test(review.workUID)) throw new Error("Review work unavailable");
      if (!excluded.has(review.workUID.toLowerCase())) return Math.max(latest, at);
      if (at <= latest) return latest;
    }
    if (result.data.reviews.length < PAGE_SIZE) return latest;
  }
  throw new Error("Contribution review history is incomplete");
}

async function latestEvidence(
  scope: Scope,
  account: Address,
  reader: GraphQLReader,
  excluded: readonly string[],
  since: number,
  signal?: AbortSignal
) {
  let before: { timestamp: number; id: string } | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const where = {
      chainId: { _eq: scope.chainId },
      actor: { _eq: account.toLowerCase() },
      eventType: { _eq: "EVIDENCE_ATTACHED" },
      commitmentEntityId: { _nin: excluded },
      ...(before
        ? {
            _or: [
              { timestamp: { _lt: before.timestamp } },
              { timestamp: { _eq: before.timestamp }, id: { _lt: before.id } },
            ],
          }
        : {}),
    };
    const events = await rows(
      reader,
      `query MemberEvidence($where: CommitmentEvent_bool_exp!) {
      CommitmentEvent(where: $where, order_by: [{timestamp: desc}, {id: desc}], limit: 50) { id chainId actor eventType timestamp commitmentEntityId }
    }`,
      { where },
      "CommitmentEvent",
      "getMemberEvidence",
      signal
    );
    if (events.length > PAGE_SIZE) throw new Error("Contribution evidence history is incomplete");
    const candidates: Array<{ at: number; row: Row }> = [];
    for (const row of events) {
      const at = timestamp(row.timestamp);
      if (
        row.chainId !== scope.chainId ||
        !same(row.actor, account) ||
        row.eventType !== "EVIDENCE_ATTACHED" ||
        typeof row.id !== "string" ||
        !row.id ||
        typeof row.commitmentEntityId !== "string" ||
        !row.commitmentEntityId.startsWith(`${scope.chainId}-`) ||
        excluded.includes(row.commitmentEntityId)
      )
        throw new Error("Evidence outside contribution scope");
      if (
        before &&
        (Number(row.timestamp) > before.timestamp ||
          (Number(row.timestamp) === before.timestamp && row.id >= before.id))
      )
        throw new Error("Evidence history did not advance");
      before = { timestamp: Number(row.timestamp), id: row.id };
      if (at <= since) break;
      candidates.push({ at, row });
    }
    if (candidates.length) {
      const ids = [...new Set(candidates.map(({ row }) => row.commitmentEntityId))];
      const commitments = await rows(
        reader,
        `query MemberEvidenceCommitments($chainId: Int!, $ids: [String!]!) {
        Commitment(where: { chainId: { _eq: $chainId }, id: { _in: $ids } }, limit: 50) { id chainId creationSeen providerGarden }
      }`,
        { chainId: scope.chainId, ids },
        "Commitment",
        "getMemberEvidenceCommitments",
        signal
      );
      const byId = new Map(commitments.map((row) => [row.id, row]));
      for (const { row, at } of candidates) {
        const commitment = byId.get(row.commitmentEntityId);
        if (
          !commitment ||
          commitment.chainId !== scope.chainId ||
          commitment.creationSeen !== true ||
          typeof commitment.providerGarden !== "string" ||
          !isAddress(commitment.providerGarden, { strict: false }) ||
          same(commitment.providerGarden, zeroAddress)
        )
          throw new Error("Evidence provider garden unavailable");
        if (same(commitment.providerGarden, scope.garden)) return at;
      }
    }
    if (events.length < PAGE_SIZE || candidates.length < events.length) return since;
  }
  throw new Error("Contribution evidence history is incomplete");
}

/** Public recorded acts only. An incomplete source cannot establish an empty or older result. */
export async function getGardenMemberContributions(
  scope: Scope,
  suppliedReaders?: Readers,
  signal?: AbortSignal
): Promise<Record<string, GardenMemberContribution>> {
  if (
    !Number.isSafeInteger(scope.chainId) ||
    scope.chainId <= 0 ||
    !isAddress(scope.garden, { strict: false }) ||
    scope.accounts.some((account) => !isAddress(account, { strict: false }))
  )
    throw new Error("Invalid contribution scope");
  const readers = suppliedReaders ?? {
    eas: createEasClient(scope.chainId),
    indexer: greenGoodsIndexer,
    reporting: createPublicReportingRead(scope.chainId),
  };
  const exclusions = await readers.reporting.links();
  const result: Record<string, GardenMemberContribution> = {};
  const accounts = [...new Set(scope.accounts.map((account) => account.toLowerCase() as Address))];
  // Bound simultaneous network reads for a roster, including large virtualized directories.
  for (let start = 0; start < accounts.length; start += 5) {
    await Promise.all(
      accounts.slice(start, start + 5).map(async (account) => {
        try {
          signal?.throwIfAborted();
          const eas = await latestEas(scope, account, readers.eas, exclusions.workUIDs, signal);
          const latest = await latestEvidence(
            scope,
            account,
            readers.indexer,
            exclusions.commitmentEntityIds,
            eas,
            signal
          );
          result[account] = latest ? { status: "recorded", at: latest } : { status: "none" };
        } catch (error) {
          if (signal?.aborted) throw error;
          result[account] = { status: "unavailable" };
        }
      })
    );
  }
  return result;
}
