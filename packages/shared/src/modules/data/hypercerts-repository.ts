import type { Address } from "viem";
import type {
  AttestationFilters,
  HypercertAttestation,
  HypercertRecord,
  HypercertStatus,
} from "../../types/hypercerts";
import { logger } from "../app/logger";
import { getJsonByHash } from "./ipfs";
import {
  getApprovedAttestations,
  getAttestationsByUIDs,
  type BundledAttestationInfo,
} from "./hypercerts-attestations";
import {
  getGardenHypercerts,
  getHypercertById,
  getHypercertClaims,
  getHypercertFromSdkApi,
} from "./hypercerts-fetch";
import { parseMetadataPayload } from "./hypercerts-metadata";

export interface HypercertSdk {
  getHypercert(hypercertId: string): Promise<Partial<HypercertRecord> | null>;
}

export interface HypercertIndexer {
  getGardenHypercerts(
    gardenId: string,
    chainId: number,
    status?: HypercertStatus,
    limit?: number
  ): Promise<HypercertRecord[]>;
  getHypercertById(hypercertId: string): Promise<HypercertRecord | null>;
  getHypercertClaims(
    hypercertId: string,
    limit?: number
  ): Promise<
    { id: string; claimant: Address; units: bigint; claimedAt: number; txHash: `0x${string}` }[]
  >;
}

export interface HypercertEas {
  getApprovedAttestations(
    gardenId: string,
    filters?: AttestationFilters,
    limit?: number
  ): Promise<HypercertAttestation[]>;
  getAttestationsByUIDs(uids: string[]): Promise<HypercertAttestation[]>;
}

export interface HypercertDocuments {
  readJson<T = unknown>(uri: string): Promise<T>;
}

export interface HypercertRepositoryDependencies {
  sdk: HypercertSdk;
  indexer: HypercertIndexer;
  eas: HypercertEas;
  documents: HypercertDocuments;
}

const defaultDependencies: HypercertRepositoryDependencies = {
  sdk: { getHypercert: getHypercertFromSdkApi },
  indexer: { getGardenHypercerts, getHypercertById, getHypercertClaims },
  eas: { getApprovedAttestations, getAttestationsByUIDs },
  documents: { readJson: getJsonByHash },
};

function sdkRecord(hypercertId: string, record: Partial<HypercertRecord>): HypercertRecord {
  return {
    id: record.id ?? hypercertId,
    tokenId: record.tokenId ?? 0n,
    gardenId: record.gardenId ?? "",
    metadataUri: record.metadataUri ?? "",
    imageUri: record.imageUri,
    mintedAt: record.mintedAt ?? 0,
    mintedBy: record.mintedBy ?? ("0x" as Address),
    txHash: record.txHash ?? ("0x" as `0x${string}`),
    totalUnits: record.totalUnits ?? 0n,
    claimedUnits: record.claimedUnits ?? 0n,
    attestationCount: record.attestationCount ?? 0,
    title: record.title,
    description: record.description,
    workScopes: record.workScopes,
    status: record.status ?? "active",
    allowlistEntries: record.allowlistEntries ?? [],
  };
}

export function createHypercertRepository({
  sdk,
  indexer,
  eas,
  documents,
}: HypercertRepositoryDependencies) {
  const hydrateHypercertMetadata = async (
    hypercertId: string,
    metadataUri?: string,
    chainId?: number
  ): Promise<Partial<HypercertRecord>> => {
    const documentRead: Promise<Partial<HypercertRecord>> = metadataUri
      ? documents.readJson<unknown>(metadataUri).then(parseMetadataPayload)
      : Promise.resolve({});
    const [sdkResult, documentResult] = await Promise.allSettled([
      sdk.getHypercert(hypercertId),
      documentRead,
    ]);
    if (sdkResult.status === "rejected") {
      logger.debug("[hypercertRepository] SDK metadata fetch failed", {
        hypercertId,
        chainId,
        error:
          sdkResult.reason instanceof Error ? sdkResult.reason.message : String(sdkResult.reason),
      });
    }
    if (documentResult.status === "rejected") {
      logger.debug("[hypercertRepository] document metadata fetch failed", {
        hypercertId,
        chainId,
        metadataUri,
        error:
          documentResult.reason instanceof Error
            ? documentResult.reason.message
            : String(documentResult.reason),
      });
    }
    const sdkMetadata = sdkResult.status === "fulfilled" && sdkResult.value ? sdkResult.value : {};
    const documentMetadata = documentResult.status === "fulfilled" ? documentResult.value : {};
    return {
      title: sdkMetadata.title ?? documentMetadata.title,
      description: sdkMetadata.description ?? documentMetadata.description,
      imageUri: sdkMetadata.imageUri ?? documentMetadata.imageUri,
      workScopes: sdkMetadata.workScopes ?? documentMetadata.workScopes,
    };
  };

  return {
    getHypercertFromSdkApi: (hypercertId: string) => sdk.getHypercert(hypercertId),
    getGardenHypercerts: (
      gardenId: string,
      chainId: number,
      status?: HypercertStatus,
      limit?: number
    ) => indexer.getGardenHypercerts(gardenId, chainId, status, limit),
    getHypercertClaims: (hypercertId: string, limit?: number) =>
      indexer.getHypercertClaims(hypercertId, limit),
    getHypercertById: async (hypercertId: string) => {
      const indexed = await indexer.getHypercertById(hypercertId);
      if (indexed) return indexed;
      const fallback = await sdk.getHypercert(hypercertId);
      return fallback ? sdkRecord(hypercertId, fallback) : null;
    },
    hydrateHypercertMetadata,
    hydrateHypercertRecords: async (records: HypercertRecord[], chainId?: number) => {
      const settled = await Promise.allSettled(
        records.map(async (record) => ({
          id: record.id,
          metadata: await hydrateHypercertMetadata(record.id, record.metadataUri, chainId),
        }))
      );
      return Object.fromEntries(
        settled.flatMap((result) =>
          result.status === "fulfilled" ? [[result.value.id, result.value.metadata]] : []
        )
      ) as Record<string, Partial<HypercertRecord>>;
    },
    getApprovedAttestations: (gardenId: string, filters?: AttestationFilters, limit?: number) =>
      eas.getApprovedAttestations(gardenId, filters, limit),
    getAttestationsByUIDs: (uids: string[]) => eas.getAttestationsByUIDs(uids),
    checkAttestationsBundled: async (
      uids: string[],
      gardenId: string,
      chainId: number,
      limit = 200
    ): Promise<BundledAttestationInfo[]> => {
      if (!uids.length || !gardenId) return [];
      const hypercerts = await indexer.getGardenHypercerts(gardenId, chainId, undefined, limit);
      const uidSet = new Set(uids);
      const bundled = new Map<string, BundledAttestationInfo>();
      for (const hypercert of hypercerts) {
        for (const uid of hypercert.attestationUIDs ?? []) {
          if (!uidSet.has(uid) || bundled.has(uid)) continue;
          bundled.set(uid, {
            uid,
            hypercertId: hypercert.id,
            hypercertTitle: hypercert.title ?? null,
          });
        }
      }
      return [...bundled.values()];
    },
  };
}

export type HypercertRepository = ReturnType<typeof createHypercertRepository>;
export const hypercertRepository = createHypercertRepository(defaultDependencies);
