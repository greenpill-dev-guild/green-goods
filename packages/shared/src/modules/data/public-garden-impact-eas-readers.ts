import { getEASConfig } from "../../config/blockchain";
import type { PublicGardenImpactSource } from "../../public-contracts/garden-impact";
import { getAssessmentSchemas } from "../assessment/schemas";
import { withTimeout, type GraphQLReader } from "./graphql-client";
import { PublicGardenImpactEasQueue } from "./public-garden-impact-eas-queue";
import { resolveIPFSUrl } from "./ipfs/resolve";
import {
  assertPublicGardenImpactChain,
  PublicGardenImpactSourceError,
  queryPublicGardenImpactRows,
  readPublicGardenImpactPages,
  requirePublicGardenImpactSchema,
  wrapPublicGardenImpactSourceError,
} from "./public-garden-impact-reader-core";
import type {
  PublicGardenImpactApprovalRecord,
  PublicGardenImpactAssessmentRecord,
  PublicGardenImpactReaders,
  PublicGardenImpactWorkRecord,
} from "./public-garden-impact";

const EAS_ATTESTATIONS_QUERY = /* GraphQL */ `
  query PublicGardenImpactAttestations(
    $where: AttestationWhereInput!
    $take: Int!
    $skip: Int!
  ) {
    attestations(
      where: $where
      orderBy: [{ timeCreated: desc }, { id: asc }]
      take: $take
      skip: $skip
    ) {
      id
      timeCreated
      decodedDataJson
    }
  }
`;

interface PublicAttestationRow {
  id: string;
  timeCreated: number | string;
  decodedDataJson: string;
}

interface DecodedField {
  name: string;
  value?: { value?: unknown; hex?: string };
}

function decodedFields(value: string): DecodedField[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? (parsed as DecodedField[]) : [];
}

function fieldValue(fields: readonly DecodedField[], name: string): unknown {
  const field = fields.find((candidate) => candidate.name === name);
  return field?.value?.value ?? field?.value?.hex;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    try {
      return value.startsWith("0x") ? Number(BigInt(value)) : Number(value);
    } catch {
      return 0;
    }
  }
  if (value && typeof value === "object") {
    if ("hex" in value && typeof value.hex === "string") {
      return numberValue(value.hex);
    }
    if ("value" in value) return numberValue((value as { value: unknown }).value);
  }
  return 0;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return typeof value === "string" && (value.toLowerCase() === "true" || value === "1");
}

async function readAttestations(input: {
  reader: GraphQLReader;
  source: PublicGardenImpactSource;
  where: Record<string, unknown>;
  operationName: string;
  signal?: AbortSignal;
}): Promise<PublicAttestationRow[]> {
  return readPublicGardenImpactPages(input.source, (take, skip) =>
    queryPublicGardenImpactRows<PublicAttestationRow>({
      ...input,
      document: EAS_ATTESTATIONS_QUERY,
      variables: { where: input.where, take, skip },
      field: "attestations",
    })
  );
}

function addressFilter(address: string): { in: string[] } {
  return { in: [...new Set([address, address.toLowerCase()])] };
}

export function createPublicGardenImpactEasReaders(
  createReader: (chainId: number) => GraphQLReader
): Pick<PublicGardenImpactReaders, "readWorks" | "readApprovals" | "readAssessments"> {
  const queue = new PublicGardenImpactEasQueue();
  const approvals = new Map<number, Promise<PublicAttestationRow[]>>();
  return {
    async readWorks(chainId, gardenAddress, signal): Promise<PublicGardenImpactWorkRecord[]> {
      assertPublicGardenImpactChain(chainId, "works");
      const schema = requirePublicGardenImpactSchema("works", getEASConfig(chainId).WORK.uid);
      try {
        const rows = await queue.run(chainId, signal, () =>
          readAttestations({
            reader: createReader(chainId),
            signal,
            source: "works",
            where: {
              schemaId: { equals: schema },
              recipient: addressFilter(gardenAddress),
              revoked: { equals: false },
            },
            operationName: "readPublicGardenImpactWorks",
          })
        );
        return rows.map((row) => {
          const fields = decodedFields(row.decodedDataJson);
          const mediaValue = fieldValue(fields, "media");
          return {
            id: row.id,
            actionUID: numberValue(fieldValue(fields, "actionUID")),
            title: String(fieldValue(fields, "title") ?? "Untitled Work"),
            feedback: String(fieldValue(fields, "feedback") ?? ""),
            media: Array.isArray(mediaValue)
              ? mediaValue
                  .filter((item): item is string => typeof item === "string")
                  .map((item) => resolveIPFSUrl(item))
              : [],
            createdAt: Number(row.timeCreated),
          };
        });
      } catch (error) {
        throw wrapPublicGardenImpactSourceError("works", error);
      }
    },

    async readApprovals(chainId, signal): Promise<PublicGardenImpactApprovalRecord[]> {
      assertPublicGardenImpactChain(chainId, "approvals");
      const schema = requirePublicGardenImpactSchema(
        "approvals",
        getEASConfig(chainId).WORK_APPROVAL.uid
      );
      try {
        signal?.throwIfAborted();
        let pending = approvals.get(chainId);
        if (!pending) {
          // This chain-wide read belongs to all its callers. One garden timing out must not
          // cancel another garden's read; its own deadline bounds both queue and network time.
          const controller = new AbortController();
          const timer = setTimeout(
            () => controller.abort(new Error("Approval read timed out")),
            20_000
          );
          pending = queue
            .run(chainId, controller.signal, () =>
              readAttestations({
                reader: createReader(chainId),
                signal: controller.signal,
                source: "approvals",
                where: { schemaId: { equals: schema }, revoked: { equals: false } },
                operationName: "readPublicGardenImpactApprovals",
              })
            )
            .finally(() => {
              clearTimeout(timer);
              approvals.delete(chainId);
            });
          approvals.set(chainId, pending);
        }
        const rows = await withTimeout(pending, 20_000, "readPublicGardenImpactApprovals", signal);
        return rows.map((row) => {
          const fields = decodedFields(row.decodedDataJson);
          return {
            id: row.id,
            workUID: String(fieldValue(fields, "workUID") ?? ""),
            approved: booleanValue(fieldValue(fields, "approved")),
            createdAt: Number(row.timeCreated),
          };
        });
      } catch (error) {
        throw wrapPublicGardenImpactSourceError("approvals", error);
      }
    },

    async readAssessments(
      chainId,
      gardenAddress,
      signal
    ): Promise<PublicGardenImpactAssessmentRecord[]> {
      assertPublicGardenImpactChain(chainId, "assessments");
      const config = getEASConfig(chainId);
      const schemas = getAssessmentSchemas(config).map((schema) => schema.uid);
      if (schemas.length === 0) {
        throw new PublicGardenImpactSourceError("assessments", "missing_schema");
      }
      try {
        const rows = await queue.run(chainId, signal, () =>
          readAttestations({
            reader: createReader(chainId),
            signal,
            source: "assessments",
            where: {
              schemaId: { in: schemas },
              recipient: addressFilter(gardenAddress),
              revoked: { equals: false },
            },
            operationName: "readPublicGardenImpactAssessments",
          })
        );
        return rows.map((row) => ({ id: row.id, createdAt: Number(row.timeCreated) }));
      } catch (error) {
        throw wrapPublicGardenImpactSourceError("assessments", error);
      }
    },
  };
}
