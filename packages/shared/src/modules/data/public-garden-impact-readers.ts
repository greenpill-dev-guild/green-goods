import type { PublicGardenImpactDomain } from "../../public-contracts/garden-impact";
import { createEasClient, greenGoodsIndexer, type GraphQLReader } from "./graphql-client";
import { createPublicGardenImpactEasReaders } from "./public-garden-impact-eas-readers";
import {
  assertPublicGardenImpactChain,
  queryPublicGardenImpactRows,
  readPublicGardenImpactPages,
  wrapPublicGardenImpactSourceError,
} from "./public-garden-impact-reader-core";
import {
  loadPublicGardenImpactSnapshot,
  type PublicGardenImpactActionRecord,
  type PublicGardenImpactCertificateRecord,
  type PublicGardenImpactGardenRecord,
  type PublicGardenImpactLoadInput,
  type PublicGardenImpactReaders,
} from "./public-garden-impact";

export {
  PUBLIC_GARDEN_IMPACT_SOURCE_LIMIT,
  PUBLIC_GARDEN_IMPACT_SOURCE_PAGE_SIZE,
  PublicGardenImpactSourceError,
  type PublicGardenImpactSourceFailureReason,
} from "./public-garden-impact-reader-core";
export {
  PublicGardenImpactNotFoundError,
  PublicGardenImpactProviderError,
} from "./public-garden-impact";

interface ReaderDependencies {
  indexerReader?: GraphQLReader;
  createEasReader?: (chainId: number) => GraphQLReader;
}

function toDomain(domain: unknown): PublicGardenImpactDomain | null {
  switch (domain) {
    case "SOLAR":
      return "solar";
    case "AGRO":
      return "agroforestry";
    case "EDU":
      return "education";
    case "WASTE":
      return "waste";
    default:
      return null;
  }
}

export function createPublicGardenImpactReaders(
  deps: ReaderDependencies = {}
): PublicGardenImpactReaders {
  const indexer = deps.indexerReader ?? greenGoodsIndexer;
  const easReaders = createPublicGardenImpactEasReaders(deps.createEasReader ?? createEasClient);

  return {
    ...easReaders,

    async readGarden(chainId, gardenAddress): Promise<PublicGardenImpactGardenRecord | null> {
      assertPublicGardenImpactChain(chainId, "works");
      const query = /* GraphQL */ `
        query PublicGardenImpactGarden($chainId: Int!, $gardenAddress: String!) {
          Garden(
            where: { chainId: { _eq: $chainId }, id: { _ilike: $gardenAddress } }
            limit: 2
          ) {
            id
            chainId
            name
            location
            initialized
          }
        }
      `;
      try {
        const rows = await queryPublicGardenImpactRows<Record<string, unknown>>({
          reader: indexer,
          document: query,
          variables: { chainId, gardenAddress },
          operationName: "readPublicGardenImpactGarden",
          field: "Garden",
          source: "works",
        });
        const garden = rows.find((row) => Number(row.chainId) === chainId);
        if (!garden || garden.initialized === false) return null;
        return {
          id: String(garden.id ?? ""),
          name: typeof garden.name === "string" && garden.name.trim() ? garden.name : null,
          location:
            typeof garden.location === "string" && garden.location.trim() ? garden.location : null,
        };
      } catch (error) {
        throw wrapPublicGardenImpactSourceError("works", error);
      }
    },

    async readActions(chainId): Promise<PublicGardenImpactActionRecord[]> {
      assertPublicGardenImpactChain(chainId, "actions");
      const query = /* GraphQL */ `
        query PublicGardenImpactActions($chainId: Int!, $limit: Int!, $offset: Int!) {
          Action(
            where: { chainId: { _eq: $chainId } }
            order_by: { id: asc }
            limit: $limit
            offset: $offset
          ) {
            id
            title
            domain
          }
        }
      `;
      try {
        const rows = await readPublicGardenImpactPages<Record<string, unknown>>(
          "actions",
          (limit, offset) =>
            queryPublicGardenImpactRows({
              reader: indexer,
              document: query,
              variables: { chainId, limit, offset },
              operationName: "readPublicGardenImpactActions",
              field: "Action",
              source: "actions",
            })
        );
        return rows.map((row) => ({
          id: String(row.id ?? ""),
          title: typeof row.title === "string" && row.title.trim() ? row.title : null,
          domain: toDomain(row.domain),
        }));
      } catch (error) {
        throw wrapPublicGardenImpactSourceError("actions", error);
      }
    },

    async readCertificates(chainId, gardenAddress): Promise<PublicGardenImpactCertificateRecord[]> {
      assertPublicGardenImpactChain(chainId, "certificates");
      const query = /* GraphQL */ `
        query PublicGardenImpactCertificates(
          $chainId: Int!
          $gardenAddress: String!
          $limit: Int!
          $offset: Int!
        ) {
          Hypercert(
            where: {
              chainId: { _eq: $chainId }
              garden: { _ilike: $gardenAddress }
            }
            order_by: { id: asc }
            limit: $limit
            offset: $offset
          ) {
            id
            status
            mintedAt
            updatedAt
          }
        }
      `;
      try {
        const rows = await readPublicGardenImpactPages<Record<string, unknown>>(
          "certificates",
          (limit, offset) =>
            queryPublicGardenImpactRows({
              reader: indexer,
              document: query,
              variables: { chainId, gardenAddress, limit, offset },
              operationName: "readPublicGardenImpactCertificates",
              field: "Hypercert",
              source: "certificates",
            })
        );
        return rows.map((row) => {
          const mintedAt = Number(row.mintedAt ?? 0);
          const updatedAt = Number(row.updatedAt ?? 0);
          return {
            id: String(row.id ?? ""),
            status:
              typeof row.status === "string" &&
              ["active", "claimed", "sold"].includes(row.status.toLowerCase())
                ? (row.status.toLowerCase() as "active" | "claimed" | "sold")
                : "unknown",
            mintedAt,
            updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : mintedAt,
          };
        });
      } catch (error) {
        throw wrapPublicGardenImpactSourceError("certificates", error);
      }
    },
  };
}

const defaultPublicGardenImpactReaders = createPublicGardenImpactReaders();

export function readPublicGardenImpactSnapshot(input: PublicGardenImpactLoadInput) {
  return loadPublicGardenImpactSnapshot(input, { readers: defaultPublicGardenImpactReaders });
}
