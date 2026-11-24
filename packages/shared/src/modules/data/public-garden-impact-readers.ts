import { Domain } from "../../types/domain";
import { DOMAIN_ACTION_DOMAIN } from "../../utils/domain";
import {
  getPublicGardenImpactChainConfig,
  isPublicGardenImpactChainSupported,
} from "../../config/blockchain";
import { getChain } from "../../config/chains";
import type { Address } from "../../public-contracts/core";
import type { PublicGardenImpactDomain } from "../../public-contracts/garden-impact";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { isUnansweredContractRead } from "../../utils/blockchain/contract-reads";
import { createPublicClient, getAddress, http } from "viem";
import { createEasClient, greenGoodsIndexer, type GraphQLReader } from "./graphql-client";
import { createPublicGardenImpactEasReaders } from "./public-garden-impact-eas-readers";
import {
  assertPublicGardenImpactChain,
  PublicGardenImpactSourceError,
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
  createChainReader?: (chainId: number, signal?: AbortSignal) => PublicGardenImpactChainReader;
}

interface PublicGardenImpactChainReader {
  readContract(input: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
}

const GARDEN_ACCOUNT_IDENTITY_ABI = [
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "location",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const GARDEN_TOKEN_MEMBERSHIP_ABI = [
  {
    type: "function",
    name: "isGardenAccount",
    stateMutability: "view",
    inputs: [{ name: "gardenAccount", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const TOKENBOUND_REGISTRY_ABI = [
  {
    type: "function",
    name: "account",
    stateMutability: "view",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "account", type: "address" }],
  },
] as const;

const GARDEN_ACCOUNT_SALT =
  "0x6551655165516551655165516551655165516551655165516551655165516551" as const;

function defaultChainReader(chainId: number, signal?: AbortSignal): PublicGardenImpactChainReader {
  return createPublicClient({
    chain: getChain(chainId),
    transport: http(getRpcUrl(chainId), { fetchOptions: { signal } }),
  }) as unknown as PublicGardenImpactChainReader;
}

function toDomain(value: unknown): PublicGardenImpactDomain | null {
  const domain = typeof value === "string" ? Domain[value as keyof typeof Domain] : undefined;
  return typeof domain === "number" ? (DOMAIN_ACTION_DOMAIN[domain] ?? null) : null;
}

export function createPublicGardenImpactReaders(
  deps: ReaderDependencies = {}
): PublicGardenImpactReaders {
  const indexer = deps.indexerReader ?? greenGoodsIndexer;
  const easReaders = createPublicGardenImpactEasReaders(deps.createEasReader ?? createEasClient);

  return {
    ...easReaders,

    async readGarden(
      chainId,
      gardenAddress,
      signal
    ): Promise<PublicGardenImpactGardenRecord | null> {
      assertPublicGardenImpactChain(chainId, "works");
      const config = getPublicGardenImpactChainConfig(chainId);
      if (!config || !isPublicGardenImpactChainSupported(chainId)) {
        throw new PublicGardenImpactSourceError("works", "unsupported_chain");
      }
      try {
        signal?.throwIfAborted();
        const chainReader =
          deps.createChainReader?.(chainId, signal) ?? defaultChainReader(chainId, signal);
        let token: unknown;
        try {
          token = await chainReader.readContract({
            address: gardenAddress,
            abi: GARDEN_ACCOUNT_IDENTITY_ABI,
            functionName: "token",
          });
        } catch (error) {
          if (isUnansweredContractRead(error)) return null;
          throw error;
        }
        if (!Array.isArray(token) || token.length !== 3)
          throw new Error("Invalid Garden token tuple");
        const tokenChainId = BigInt(token[0] as bigint | number | string);
        const tokenContract = getAddress(String(token[1]));
        const tokenId = BigInt(token[2] as bigint | number | string);
        if (
          tokenChainId !== BigInt(chainId) ||
          tokenContract.toLowerCase() !== config.gardenToken.toLowerCase()
        ) {
          return null;
        }
        let isGarden: boolean;
        try {
          isGarden = (await chainReader.readContract({
            address: tokenContract as Address,
            abi: GARDEN_TOKEN_MEMBERSHIP_ABI,
            functionName: "isGardenAccount",
            args: [gardenAddress],
          })) as boolean;
        } catch (error) {
          if (!isUnansweredContractRead(error)) throw error;
          // A token from before upgradeable accounts has no such read, and all its gardens derive
          // from the one implementation.
          const expectedAccount = await chainReader.readContract({
            address: getAddress(config.tokenboundRegistry) as Address,
            abi: TOKENBOUND_REGISTRY_ABI,
            functionName: "account",
            args: [
              getAddress(config.gardenAccountImpl),
              GARDEN_ACCOUNT_SALT,
              tokenChainId,
              tokenContract,
              tokenId,
            ],
          });
          isGarden =
            getAddress(String(expectedAccount)).toLowerCase() === gardenAddress.toLowerCase();
        }
        if (!isGarden) return null;
        const [name, location] = await Promise.all([
          chainReader.readContract({
            address: gardenAddress,
            abi: GARDEN_ACCOUNT_IDENTITY_ABI,
            functionName: "name",
          }),
          chainReader.readContract({
            address: gardenAddress,
            abi: GARDEN_ACCOUNT_IDENTITY_ABI,
            functionName: "location",
          }),
        ]);
        return {
          id: gardenAddress,
          name: typeof name === "string" && name.trim() ? name : null,
          location: typeof location === "string" && location.trim() ? location : null,
        };
      } catch (error) {
        throw wrapPublicGardenImpactSourceError("works", error);
      }
    },

    async readActions(chainId, signal): Promise<PublicGardenImpactActionRecord[]> {
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
              signal,
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

    async readCertificates(
      chainId,
      gardenAddress,
      signal
    ): Promise<PublicGardenImpactCertificateRecord[]> {
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
              signal,
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
