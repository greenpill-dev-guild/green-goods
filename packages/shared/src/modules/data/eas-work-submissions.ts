import { isHash, type Hex } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { parseDataToWork } from "./eas-parse";
import { EASFetchError, validatedAttestations } from "./eas-read-validation";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";

const PAGE_SIZE = 100;
const OPERATION = "getWorkSubmissionsSince";

export interface WorkSubmission {
  work: EASWork;
  /** The transaction that carried the attestation, when the indexer reports one. */
  transactionHash?: Hex;
}

/**
 * Work one gardener attested to one garden since a moment, with the
 * transaction that carried each.
 *
 * Addresses match regardless of case: a casing mismatch must never read as
 * "this work is not on-chain".
 */
export async function getWorkSubmissionsSince(
  input: { attester: Address; garden: Address; chainId: number; sinceSeconds: number },
  reader: GraphQLReader = createEasClient(input.chainId)
): Promise<WorkSubmission[]> {
  const easConfig = getEASConfig(input.chainId);
  if (isZeroBytes32(easConfig.WORK.uid)) return [];

  const QUERY = easGraphQL(/* GraphQL */ `
    query WorkSubmissionsSince($where: AttestationWhereInput, $take: Int!, $skip: Int!) {
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
  const where = {
    schemaId: { equals: easConfig.WORK.uid },
    attester: { equals: input.attester, mode: "insensitive" as const },
    recipient: { equals: input.garden, mode: "insensitive" as const },
    revoked: { equals: false },
    timeCreated: { gte: Math.max(0, Math.floor(input.sinceSeconds)) },
  };

  const submissions: WorkSubmission[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const { data, error } = await reader.query(QUERY, { where, take: PAGE_SIZE, skip }, OPERATION);
    const page: unknown = data?.attestations;
    if (error || !Array.isArray(page)) {
      throw new EASFetchError(
        `Failed to fetch work submissions: ${error?.message ?? "Invalid attestations response"}`,
        OPERATION,
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
    for (const { id, attester, recipient, timeCreated, decodedDataJson } of validatedAttestations(
      page,
      OPERATION
    )) {
      const txid = transactionIds.get(id);
      submissions.push({
        work: parseDataToWork(
          id,
          { attester, recipient, time: Number(timeCreated) },
          decodedDataJson
        ),
        ...(typeof txid === "string" && isHash(txid) ? { transactionHash: txid } : {}),
      });
    }
    if (page.length < PAGE_SIZE) return submissions;
  }
}
