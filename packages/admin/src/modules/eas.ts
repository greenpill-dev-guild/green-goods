import { getEASConfig } from "@/config";

import { easGraphQL } from "./graphql";
import { createEasClient } from "./urql";

const GARDEN_ASSESSMENTS_QUERY = easGraphQL(/* GraphQL */ `
  query GardenAssessments($where: AttestationWhereInput) {
    attestations(where: $where) {
      id
      attester
      recipient
      timeCreated
      decodedDataJson
    }
  }
`);

export interface GardenAssessmentAttestation {
  id: string;
  attester: string;
  recipient: string;
  time: number;
  decodedDataJson: string | null;
}

interface FetchGardenAssessmentsOptions {
  gardenAddress: string;
  chainId?: number | string;
  limit?: number;
}

export async function fetchGardenAssessments({
  gardenAddress,
  chainId,
  limit,
}: FetchGardenAssessmentsOptions): Promise<GardenAssessmentAttestation[]> {
  const client = createEasClient(chainId);
  const schemaId = { equals: getEASConfig(chainId).GARDEN_ASSESSMENT.uid };

  const { data, error } = await client
    .query(GARDEN_ASSESSMENTS_QUERY, {
      where: {
        schemaId,
        recipient: { equals: gardenAddress },
        revoked: { equals: false },
      },
    })
    .toPromise();

  if (error) {
    throw new Error(error.message);
  }

  const attestations = [...(data?.attestations ?? [])]
    .sort((a, b) => Number(b.timeCreated) - Number(a.timeCreated))
    .slice(0, limit ?? Number.MAX_SAFE_INTEGER);

  return attestations.map((attestation) => ({
    id: attestation.id,
    attester: attestation.attester,
    recipient: attestation.recipient,
    time: Number(attestation.timeCreated ?? 0),
    decodedDataJson: attestation.decodedDataJson ?? null,
  }));
}
