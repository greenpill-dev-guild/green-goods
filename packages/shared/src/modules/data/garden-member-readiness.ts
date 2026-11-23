import { isAddress } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { withLatestApproval } from "../work/work-list";
import { readWorkVisibility, type WorkVisibilitySnapshot } from "../work/work-visibility";
import { readWorkApprovalsForWorks } from "./eas-work-list";
import { parseDataToWork } from "./eas-parse";
import { easStoredAddress, validatedAttestations } from "./eas-read-validation";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";

/**
 * How far a member has come, read from what the chain records of them in one garden: joined
 * only, sent work, or had work approved. Nothing is stored or set by hand (PRD-1537).
 */
type MemberReadinessStage = "registered" | "gettingStarted" | "contributing";

export type GardenMemberReadiness =
  | { status: "loading" | "unavailable" }
  | {
      status: "read";
      stage: MemberReadinessStage;
      /** When their first work in the garden was sent (ms); null when none was. */
      firstSentAt: number | null;
      /**
       * When the earliest of their approved works was approved (ms), each work by the decision
       * that stands; null when none of their work stands approved.
       */
      firstApprovedAt: number | null;
    };

interface Scope {
  garden: Address;
  accounts: readonly Address[];
  chainId: number;
}

const PAGE_SIZE = 100;
/** Past this many works one member's evidence is not read further. */
const MAX_PAGES = 5;

const QUERY = easGraphQL(/* GraphQL */ `
  query MemberReadinessWorks($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
    attestations(
      where: $where
      take: $take
      skip: $skip
      orderBy: [{ timeCreated: asc }, { id: asc }]
    ) {
      id
      attester
      recipient
      timeCreated
      decodedDataJson
    }
  }
`);

/** The stage a member's evidence puts them at. */
function readinessStage(
  firstSentAt: number | null,
  firstApprovedAt: number | null
): MemberReadinessStage {
  if (firstApprovedAt !== null) return "contributing";
  return firstSentAt !== null ? "gettingStarted" : "registered";
}

async function readOne(
  scope: Scope,
  account: Address,
  reader: GraphQLReader,
  visibility: WorkVisibilitySnapshot,
  signal?: AbortSignal
): Promise<GardenMemberReadiness> {
  const config = getEASConfig(scope.chainId);
  const where = {
    schemaId: { equals: config.WORK.uid },
    recipient: { equals: easStoredAddress(scope.garden) },
    attester: { equals: easStoredAddress(account) },
    revoked: { equals: false },
    ...(visibility.excludedWorkUIDs.length
      ? { id: { notIn: [...visibility.excludedWorkUIDs] } }
      : {}),
  };
  const works: { id: string; at: number; row: Parameters<typeof withLatestApproval>[0] }[] = [];
  let whole = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    signal?.throwIfAborted();
    const { data, error } = await reader.query(
      QUERY,
      { where, take: PAGE_SIZE, skip: page * PAGE_SIZE },
      "getMemberReadinessWorks",
      signal
    );
    if (error || !Array.isArray(data?.attestations)) throw error ?? new Error("Works unavailable");
    // A row that could not be read is one this member's evidence cannot rule out.
    const rows = validatedAttestations(data.attestations, "getMemberReadinessWorks");
    if (rows.length < data.attestations.length) throw new Error("Malformed work in evidence");
    for (const row of rows) {
      if (row.attester.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Work outside the member's evidence");
      }
      works.push({
        id: row.id,
        at: Number(row.timeCreated) * 1000,
        row: parseDataToWork(
          row.id,
          { attester: row.attester, recipient: row.recipient, time: Number(row.timeCreated) },
          row.decodedDataJson
        ),
      });
    }
    if (data.attestations.length < PAGE_SIZE) {
      whole = true;
      break;
    }
  }
  const firstSentAt = works[0]?.at ?? null;
  if (works.length === 0) {
    return { status: "read", stage: "registered", firstSentAt: null, firstApprovedAt: null };
  }
  // On a chain with no decision schema whether work is approved is unknown, not "no".
  if (isZeroBytes32(config.WORK_APPROVAL.uid)) return { status: "unavailable" };
  const { approvals, failedWorkUIDs, dropped } = await readWorkApprovalsForWorks(
    works.map((work) => work.id),
    scope.chainId,
    reader
  );
  if (failedWorkUIDs.length > 0) return { status: "unavailable" };
  const excluded = new Set(visibility.excludedApprovalUIDs.map((uid) => uid.toLowerCase()));
  const byWork = new Map<string, typeof approvals>();
  for (const approval of approvals) {
    if (excluded.has(approval.id.toLowerCase())) continue;
    const key = approval.workUID.toLowerCase();
    byWork.set(key, [...(byWork.get(key) ?? []), approval]);
  }
  // A work counts as approved by the decision that stands, its latest, as Review reads it: an
  // approval a later decision reversed does not count.
  const approvedAt = works.flatMap((work) => {
    const latest = withLatestApproval(work.row, byWork.get(work.id.toLowerCase()) ?? []).approval;
    return latest?.approved ? [latest.createdAt * 1000] : [];
  });
  const firstApprovedAt = approvedAt.length > 0 ? Math.min(...approvedAt) : null;
  // A decision row that could not be read may be the approval, or a later decision reversing
  // one, so with any of them unread the stage is unknown.
  if (dropped > 0) return { status: "unavailable" };
  // Past the read's limit, a member with no approval found may still have one.
  if (firstApprovedAt === null && !whole) return { status: "unavailable" };
  return {
    status: "read",
    stage: readinessStage(firstSentAt, firstApprovedAt),
    firstSentAt,
    firstApprovedAt,
  };
}

/**
 * Each member's readiness evidence in one garden: their first work sent and the first decision
 * approving their work, from the garden's own records, leaving out hidden work and decisions. A
 * member whose evidence cannot be read in full is unavailable, never "registered".
 */
export async function getGardenMemberReadiness(
  scope: Scope,
  reader: GraphQLReader = createEasClient(scope.chainId),
  signal?: AbortSignal
): Promise<Record<string, GardenMemberReadiness>> {
  if (
    !isAddress(scope.garden, { strict: false }) ||
    scope.accounts.some((account) => !isAddress(account, { strict: false }))
  ) {
    throw new Error("Invalid readiness scope");
  }
  if (isZeroBytes32(getEASConfig(scope.chainId).WORK.uid)) throw new Error("No work schema");
  const visibility = await readWorkVisibility(scope.chainId);
  const result: Record<string, GardenMemberReadiness> = {};
  const accounts = [...new Set(scope.accounts.map((account) => account.toLowerCase() as Address))];
  // Bounded, as the contribution read is, so a large roster does not flood the reader.
  for (let start = 0; start < accounts.length; start += 5) {
    await Promise.all(
      accounts.slice(start, start + 5).map(async (account) => {
        try {
          result[account] = await readOne(scope, account, reader, visibility, signal);
        } catch (error) {
          if (signal?.aborted) throw error;
          result[account] = { status: "unavailable" };
        }
      })
    );
  }
  return result;
}
