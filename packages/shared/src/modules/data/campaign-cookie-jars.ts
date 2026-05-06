import { createPublicClient, http } from "viem";
import { DEFAULT_CHAIN_ID, getNetworkConfig } from "../../config/blockchain";
import { logger } from "../../modules/app/logger";
import type { CampaignCookieJarCampaign, IndexedCampaignCookieJar } from "../../types/cookie-jar";
import type { Address } from "../../types/domain";
import { DEPLOYMENT_REGISTRY_ABI, COOKIE_JAR_FACTORY_ABI } from "../../utils/blockchain/abis";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getChain, getNetworkContracts } from "../../utils/blockchain/contracts";
import {
  buildCampaignCookieJarCampaigns,
  normalizeCampaignAddress,
} from "../../utils/cookie-jar-campaign";
import { greenGoodsIndexer } from "./graphql-client";

interface CampaignCookieJarIndexerRow {
  id: string;
  chainId: number;
  factoryAddress: string;
  jarAddress: string;
  creator: string;
  rawMetadata: string;
  metadataKind?: string | null;
  metadataVersion?: number | null;
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  externalUrl?: string | null;
  sourceGardens?: string[] | null;
  operatorPolicy?: string | null;
  extraAllowlist?: string[] | null;
  isValidCampaign: boolean;
  createdAt: number;
  metadataUpdatedAt: number;
  txHash: string;
}

interface CampaignCookieJarIndexerResponse {
  CampaignCookieJar?: CampaignCookieJarIndexerRow[];
}

interface GetIndexedCampaignCookieJarsOptions {
  trustedCreators?: readonly Address[];
  limit?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const CAMPAIGN_COOKIE_JARS_QUERY = /* GraphQL */ `
  query CampaignCookieJars($chainId: Int!, $limit: Int!) {
    CampaignCookieJar(where: { chainId: { _eq: $chainId } }, order_by: { createdAt: desc }, limit: $limit) {
      id
      chainId
      factoryAddress
      jarAddress
      creator
      rawMetadata
      metadataKind
      metadataVersion
      slug
      title
      description
      image
      externalUrl
      sourceGardens
      operatorPolicy
      extraAllowlist
      isValidCampaign
      createdAt
      metadataUpdatedAt
      txHash
    }
  }
`;

const CAMPAIGN_COOKIE_JARS_BY_CREATORS_QUERY = /* GraphQL */ `
  query CampaignCookieJarsByCreators($chainId: Int!, $creators: [String!]!, $limit: Int!) {
    CampaignCookieJar(
      where: { chainId: { _eq: $chainId }, creator: { _in: $creators } }
      order_by: { createdAt: desc }
      limit: $limit
    ) {
      id
      chainId
      factoryAddress
      jarAddress
      creator
      rawMetadata
      metadataKind
      metadataVersion
      slug
      title
      description
      image
      externalUrl
      sourceGardens
      operatorPolicy
      extraAllowlist
      isValidCampaign
      createdAt
      metadataUpdatedAt
      txHash
    }
  }
`;

function getAlchemyKey(): string {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta.env as { VITE_ALCHEMY_API_KEY?: string })
      : {};
  return env.VITE_ALCHEMY_API_KEY || "demo";
}

function createChainPublicClient(chainId: number) {
  const networkConfig = getNetworkConfig(chainId, getAlchemyKey());
  return createPublicClient({
    chain: getChain(chainId),
    transport: http(networkConfig.rpcUrl),
  });
}

function normalizeIndexedCampaignCookieJar(
  row: CampaignCookieJarIndexerRow
): IndexedCampaignCookieJar | null {
  const factoryAddress = normalizeCampaignAddress(row.factoryAddress);
  const jarAddress = normalizeCampaignAddress(row.jarAddress);
  const creator = normalizeCampaignAddress(row.creator);
  if (!factoryAddress || !jarAddress || !creator) return null;

  return {
    id: row.id,
    chainId: row.chainId,
    factoryAddress,
    jarAddress,
    creator,
    rawMetadata: row.rawMetadata ?? "",
    metadataKind: row.metadataKind,
    metadataVersion: row.metadataVersion,
    slug: row.slug,
    title: row.title,
    description: row.description,
    image: row.image,
    externalUrl: row.externalUrl,
    sourceGardens: (row.sourceGardens ?? [])
      .map((address) => normalizeCampaignAddress(address))
      .filter((address): address is Address => Boolean(address)),
    operatorPolicy: row.operatorPolicy,
    extraAllowlist: (row.extraAllowlist ?? [])
      .map((address) => normalizeCampaignAddress(address))
      .filter((address): address is Address => Boolean(address)),
    isValidCampaign: row.isValidCampaign,
    createdAt: row.createdAt,
    metadataUpdatedAt: row.metadataUpdatedAt,
    txHash: row.txHash,
  };
}

function normalizeTrustedCreatorQueryValues(
  creators: readonly Address[] | undefined
): string[] | undefined {
  if (!creators) return undefined;

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const creator of creators) {
    const address = normalizeCampaignAddress(creator);
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return normalized;
}

function filterIndexedJarsByTrustedCreators(
  indexedJars: readonly IndexedCampaignCookieJar[],
  trustedCreators: readonly Address[]
): IndexedCampaignCookieJar[] {
  const trusted = new Set(
    normalizeTrustedCreatorQueryValues(trustedCreators)?.map((address) => address.toLowerCase()) ??
      []
  );
  if (trusted.size === 0) return [];

  return indexedJars.filter((indexedJar) => {
    const creator = normalizeCampaignAddress(indexedJar.creator);
    return Boolean(creator && trusted.has(creator.toLowerCase()));
  });
}

export async function getIndexedCampaignCookieJars(
  chainId = DEFAULT_CHAIN_ID,
  options: GetIndexedCampaignCookieJarsOptions = {}
): Promise<IndexedCampaignCookieJar[]> {
  const creators = normalizeTrustedCreatorQueryValues(options.trustedCreators);
  if (options.trustedCreators && creators?.length === 0) return [];

  const query = creators ? CAMPAIGN_COOKIE_JARS_BY_CREATORS_QUERY : CAMPAIGN_COOKIE_JARS_QUERY;
  const variables = creators
    ? { chainId, creators, limit: options.limit ?? 100 }
    : { chainId, limit: options.limit ?? 100 };

  const { data, error } = await greenGoodsIndexer.query<
    CampaignCookieJarIndexerResponse,
    { chainId: number; limit: number; creators?: string[] }
  >(query, variables, "getIndexedCampaignCookieJars");

  if (error) {
    logger.warn("[CampaignCookieJars] Indexer query failed", { error: error.message });
    throw new Error(`Campaign cookie jar indexer query failed: ${error.message}`);
  }

  return (data?.CampaignCookieJar ?? [])
    .map(normalizeIndexedCampaignCookieJar)
    .filter((row): row is IndexedCampaignCookieJar => Boolean(row));
}

export async function getCampaignCookieJarTrustedCreators(
  chainId = DEFAULT_CHAIN_ID
): Promise<Address[]> {
  const contracts = getNetworkContracts(chainId);
  if (isZeroAddress(contracts.deploymentRegistry)) return [];

  const publicClient = createChainPublicClient(chainId);
  const [ownerResult, allowlistResult] = await Promise.allSettled([
    publicClient.readContract({
      address: contracts.deploymentRegistry,
      abi: DEPLOYMENT_REGISTRY_ABI,
      functionName: "owner",
    }),
    publicClient.readContract({
      address: contracts.deploymentRegistry,
      abi: DEPLOYMENT_REGISTRY_ABI,
      functionName: "getAllowlist",
    }),
  ]);

  if (ownerResult.status === "rejected" && allowlistResult.status === "rejected") {
    logger.warn("[CampaignCookieJars] DeploymentRegistry trust reads failed", {
      ownerError: ownerResult.reason,
      allowlistError: allowlistResult.reason,
    });
    throw new Error(
      `Campaign cookie jar trust registry reads failed: ${errorMessage(ownerResult.reason)}; ${errorMessage(allowlistResult.reason)}`
    );
  }

  const owner =
    ownerResult.status === "fulfilled" ? normalizeCampaignAddress(ownerResult.value) : null;
  const allowlist =
    allowlistResult.status === "fulfilled"
      ? allowlistResult.value
          .map((address) => normalizeCampaignAddress(address))
          .filter((address): address is Address => Boolean(address))
      : [];
  const trusted = new Map<string, Address>();

  if (owner) trusted.set(owner.toLowerCase(), owner);
  for (const address of allowlist) {
    trusted.set(address.toLowerCase(), address);
  }

  return Array.from(trusted.values());
}

async function readCampaignCookieJarMetadata(
  chainId: number,
  indexedJars: readonly IndexedCampaignCookieJar[]
): Promise<Record<string, string | undefined>> {
  const publicClient = createChainPublicClient(chainId);
  const configuredFactory = getNetworkContracts(chainId).cookieJarFactory;
  const entries = await Promise.all(
    indexedJars.map(async (indexedJar) => {
      const factoryAddress = isZeroAddress(indexedJar.factoryAddress)
        ? configuredFactory
        : indexedJar.factoryAddress;
      const jarKey = indexedJar.jarAddress.toLowerCase();
      if (isZeroAddress(factoryAddress)) {
        return [jarKey, indexedJar.rawMetadata] as const;
      }

      try {
        const metadata = await publicClient.readContract({
          address: factoryAddress,
          abi: COOKIE_JAR_FACTORY_ABI,
          functionName: "getMetadata",
          args: [indexedJar.jarAddress],
        });
        return [jarKey, typeof metadata === "string" ? metadata : indexedJar.rawMetadata] as const;
      } catch (error) {
        logger.warn("[CampaignCookieJars] Metadata read failed", {
          jarAddress: indexedJar.jarAddress,
          error,
        });
        return [jarKey, indexedJar.rawMetadata] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

export async function getCampaignCookieJarCampaigns(
  chainId = DEFAULT_CHAIN_ID
): Promise<CampaignCookieJarCampaign[]> {
  const trustedCreators = await getCampaignCookieJarTrustedCreators(chainId);
  if (trustedCreators.length === 0) return [];

  const indexedJars = await getIndexedCampaignCookieJars(chainId, { trustedCreators });
  const trustedIndexedJars = filterIndexedJarsByTrustedCreators(indexedJars, trustedCreators);
  if (trustedIndexedJars.length === 0) return [];

  const metadataByJarAddress = await readCampaignCookieJarMetadata(chainId, trustedIndexedJars);
  return buildCampaignCookieJarCampaigns({
    indexedJars: trustedIndexedJars,
    trustedCreators,
    metadataByJarAddress,
  });
}
