import { isAddress } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { readWorkVisibility, type WorkVisibilitySnapshot } from "../work/work-visibility";
import { readWorkApprovalsForWorks } from "./eas-work-list";
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
      /** When the first decision approving their work landed (ms); null when none has. */
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
  const works: { id: string; at: number }[] = [];
  let whole = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    signal?.throwIfAborted();
    const { data, error } = await reader.query(
      QUERY,
      { where, take: PAGE_SIZE, skip: page * PAGE_SIZE },
      "getMemberReadinessWorks"
    );
    if (error || !Array.isArray(data?.attestations)) throw error ?? new Error("Works unavailable");
    // A row that could not be read is one this member's evidence cannot rule out.
    const rows = validatedAttestations(data.attestations, "getMemberReadinessWorks");
    if (rows.length < data.attestations.length) throw new Error("Malformed work in evidence");
    for (const row of rows) {
      if (row.attester.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Work outside the member's evidence");
      }
      works.push({ id: row.id, at: Number(row.timeCreated) * 1000 });
    }
    if (data.attestations.length < PAGE_SIZE) {
      whole = true;
      break;
    }
  }
  const firstSentAt = works[0]?.at ?? null;
  // A chain with no decision schema can approve nothing, so no member there has approved work.
  if (works.length === 0 || isZeroBytes32(config.WORK_APPROVAL.uid)) {
    return {
      status: "read",
      stage: readinessStage(firstSentAt, null),
      firstSentAt,
      firstApprovedAt: null,
    };
  }
  const { approvals, failedWorkUIDs } = await readWorkApprovalsForWorks(
    works.map((work) => work.id),
    scope.chainId,
    reader
  );
  if (failedWorkUIDs.length > 0) return { status: "unavailable" };
  const excluded = new Set(visibility.excludedApprovalUIDs.map((uid) => uid.toLowerCase()));
  const approvedAt = approvals
    .filter((approval) => approval.approved && !excluded.has(approval.id.toLowerCase()))
    .map((approval) => approval.createdAt * 1000);
  const firstApprovedAt = approvedAt.length > 0 ? Math.min(...approvedAt) : null;
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
