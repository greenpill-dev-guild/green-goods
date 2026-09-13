import { getEASConfig } from "../../config/blockchain";
import type { EASWork, EASWorkApproval } from "../../types/eas-responses";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { parseDataToWork, parseDataToWorkApproval } from "./eas-parse";
import { EASFetchError, validatedAttestations } from "./eas-read-validation";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";

/** The preparation coordinator requests a bounded, stable newest-first page. */
export const getRecentWorks = async (
  gardenAddress: string,
  limit: number,
  chainId?: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<EASWork[]> => {
  const take = Math.max(1, Math.min(50, Math.floor(limit)));
  if (!gardenAddress || !Number.isFinite(take)) return [];
  const config = getEASConfig(chainId);
  if (isZeroBytes32(config.WORK.uid)) return [];
  const query = easGraphQL(/* GraphQL */ `
    query RecentWorks($where: AttestationWhereInput, $take: Int!) {
      attestations(where: $where, take: $take, orderBy: [{ timeCreated: desc }, { id: desc }]) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);
  const { data, error } = await reader.query(
    query,
    {
      where: {
        schemaId: { equals: config.WORK.uid },
        recipient: { equals: gardenAddress },
        revoked: { equals: false },
      },
      take,
    },
    "getRecentWorks"
  );
  if (error || !Array.isArray(data?.attestations)) {
    throw new EASFetchError("Could not prepare recent work", "getRecentWorks", error);
  }
  const valid = validatedAttestations(data.attestations, "getRecentWorks");
  if (valid.length !== data.attestations.length) {
    throw new EASFetchError("Recent work contains unreadable records", "getRecentWorks");
  }
  return valid.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
    parseDataToWork(id, { attester, recipient, time: Number(timeCreated) }, decodedDataJson)
  );
};

/** Bounded approval coverage for the prepared work page, without scanning all gardens. */
export const getPreparedWorkApprovals = async (
  workUIDs: string[],
  chainId: number | string,
  reader: GraphQLReader = createEasClient(chainId)
): Promise<{ approvals: EASWorkApproval[]; truncated: boolean }> => {
  if (!workUIDs.length) return { approvals: [], truncated: false };
  if (workUIDs.length > 50) throw new Error("Approval preparation accepts at most 50 work records");
  const config = getEASConfig(chainId);
  if (isZeroBytes32(config.WORK_APPROVAL.uid)) return { approvals: [], truncated: false };
  const query = easGraphQL(/* GraphQL */ `
    query PreparedWorkApprovals($where: AttestationWhereInput, $take: Int!) {
      attestations(where: $where, take: $take, orderBy: [{ timeCreated: desc }, { id: desc }]) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
      }
    }
  `);
  const { data, error } = await reader.query(
    query,
    {
      where: {
        schemaId: { equals: config.WORK_APPROVAL.uid },
        revoked: { equals: false },
        OR: workUIDs.map((uid) => ({ decodedDataJson: { contains: uid } })),
      },
      take: 250,
    },
    "getPreparedWorkApprovals"
  );
  if (error || !Array.isArray(data?.attestations))
    throw new EASFetchError("Could not prepare approval status", "getPreparedWorkApprovals", error);
  const ids = new Set(workUIDs.map((id) => id.toLowerCase()));
  const valid = validatedAttestations(data.attestations, "getPreparedWorkApprovals");
  if (valid.length !== data.attestations.length)
    throw new EASFetchError("Unreadable approval status", "getPreparedWorkApprovals");
  return {
    truncated: data.attestations.length === 250,
    approvals: valid
      .map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
        parseDataToWorkApproval(
          id,
          { attester, recipient, time: Number(timeCreated) },
          decodedDataJson
        )
      )
      .filter((approval) => ids.has(approval.workUID.toLowerCase())),
  };
};
