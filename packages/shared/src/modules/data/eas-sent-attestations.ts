/**
 * Attestations a person sent, with the transaction that carried each
 *
 * These reads settle a queued send whose answer was lost, so they never infer
 * absence from an error, and addresses match regardless of case: a casing
 * mismatch must never read as "this attestation is not on-chain".
 *
 * @module modules/data/eas-sent-attestations
 */

import type { VariablesOf } from "gql.tada";
import { isHash, type Hex } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type { EASAttestationRaw, EASWork, EASWorkApproval } from "../../types/eas-responses";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { parseDataToWork, parseDataToWorkApproval } from "./eas-parse";
import { EASFetchError, validatedAttestations } from "./eas-read-validation";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";

const PAGE_SIZE = 100;

export interface WorkSubmission {
  work: EASWork;
  /** The transaction that carried the attestation, when the indexer reports one. */
  transactionHash?: Hex;
}

export interface WorkDecision {
  decision: EASWorkApproval;
  /** The transaction that carried the attestation, when the indexer reports one. */
  transactionHash?: Hex;
}

const SENT_ATTESTATIONS_QUERY = easGraphQL(/* GraphQL */ `
  query SentAttestations($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
    attestations(where: $where, take: $take, skip: $skip, orderBy: [{ id: asc }]) {
      id
      attester
      recipient
      timeCreated
      decodedDataJson
      txid
    }
  }
`);

type AttestationWhere = NonNullable<VariablesOf<typeof SENT_ATTESTATIONS_QUERY>["where"]>;

async function readSentAttestations(
  reader: GraphQLReader,
  where: AttestationWhere,
  operation: string
): Promise<Array<{ record: EASAttestationRaw; transactionHash?: Hex }>> {
  const sent: Array<{ record: EASAttestationRaw; transactionHash?: Hex }> = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const { data, error } = await reader.query(
      SENT_ATTESTATIONS_QUERY,
      { where, take: PAGE_SIZE, skip },
      operation
    );
    const page: unknown = data?.attestations;
    if (error || !Array.isArray(page)) {
      throw new EASFetchError(
        `Failed to fetch sent attestations: ${error?.message ?? "Invalid attestations response"}`,
        operation,
        error
      );
    }
    // Validation keeps only the attestation record, so the transaction id is read beside it.
    const transactionIds = new Map<unknown, unknown>(
      page.map((row) => [
        (row as { id?: unknown } | null)?.id,
        (row as { txid?: unknown } | null)?.txid,
      ])
    );
    for (const record of validatedAttestations(page, operation)) {
      const txid = transactionIds.get(record.id);
      sent.push({
        record,
        ...(typeof txid === "string" && isHash(txid) ? { transactionHash: txid } : {}),
      });
    }
    if (page.length < PAGE_SIZE) return sent;
  }
}

/** Work one gardener attested to one garden since a moment. */
export async function getWorkSubmissionsSince(
  input: { attester: Address; garden: Address; chainId: number; sinceSeconds: number },
  reader: GraphQLReader = createEasClient(input.chainId)
): Promise<WorkSubmission[]> {
  const easConfig = getEASConfig(input.chainId);
  if (isZeroBytes32(easConfig.WORK.uid)) return [];
  const sent = await readSentAttestations(
    reader,
    {
      schemaId: { equals: easConfig.WORK.uid },
      attester: { equals: input.attester, mode: "insensitive" },
      recipient: { equals: input.garden, mode: "insensitive" },
      revoked: { equals: false },
      timeCreated: { gte: Math.max(0, Math.floor(input.sinceSeconds)) },
    },
    "getWorkSubmissionsSince"
  );
  return sent.map(({ record, transactionHash }) => ({
    work: parseDataToWork(
      record.id,
      { attester: record.attester, recipient: record.recipient, time: Number(record.timeCreated) },
      record.decodedDataJson
    ),
    ...(transactionHash ? { transactionHash } : {}),
  }));
}

/** Decisions one steward attested about one piece of work since a moment. */
export async function getWorkDecisionsSince(
  input: { attester: Address; workUID: string; chainId: number; sinceSeconds: number },
  reader: GraphQLReader = createEasClient(input.chainId)
): Promise<WorkDecision[]> {
  const easConfig = getEASConfig(input.chainId);
  if (isZeroBytes32(easConfig.WORK_APPROVAL.uid)) return [];
  const sent = await readSentAttestations(
    reader,
    {
      schemaId: { equals: easConfig.WORK_APPROVAL.uid },
      attester: { equals: input.attester, mode: "insensitive" },
      decodedDataJson: { contains: input.workUID, mode: "insensitive" },
      revoked: { equals: false },
      timeCreated: { gte: Math.max(0, Math.floor(input.sinceSeconds)) },
    },
    "getWorkDecisionsSince"
  );
  return sent
    .map(({ record, transactionHash }) => ({
      decision: parseDataToWorkApproval(
        record.id,
        {
          attester: record.attester,
          recipient: record.recipient,
          time: Number(record.timeCreated),
        },
        record.decodedDataJson
      ),
      ...(transactionHash ? { transactionHash } : {}),
    }))
    .filter(({ decision }) => decision.workUID.toLowerCase() === input.workUID.toLowerCase());
}
