#!/usr/bin/env bun

import "dotenv/config";

import { create } from "@storacha/client";
import { Signer } from "@storacha/client/principal/ed25519";
import { parse as parseProof } from "@storacha/client/proof";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { parseArgs } from "node:util";
import { CID } from "multiformats/cid";
import {
  ensureHybridCidAvailability,
  loadPinataConfigFromEnv,
} from "./lib/ipfs-hybrid";

const DEFAULT_GATEWAYS = ["https://storacha.link", "https://w3s.link", "https://ipfs.io"];
const DEFAULT_INDEXER_URL =
  process.env.VITE_ENVIO_INDEXER_URL?.trim() || "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";
const TEXT_DECODER = new TextDecoder();
const CAR_CONTENT_TYPE = "application/vnd.ipld.car";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const pinataConfig = loadPinataConfigFromEnv();

const CHAIN_CONFIGS = {
  11155111: {
    label: "sepolia",
    easGraphqlUrl: "https://sepolia.easscan.org/graphql",
    gardensStudioUrl:
      "https://api.studio.thegraph.com/query/70985/gardens-v-2-sepolia/version/latest",
  },
  42161: {
    label: "arbitrum",
    easGraphqlUrl: "https://arbitrum.easscan.org/graphql",
    gardensStudioUrl:
      "https://api.studio.thegraph.com/query/102093/gardens-v2---arbitrum/version/latest",
    gardensGatewayId: "9ejruFicuLT6hfuXNTnS8UCwxTWrHz4uinesdZu1dKmk",
  },
  42220: {
    label: "celo",
    easGraphqlUrl: "https://celo.easscan.org/graphql",
    gardensStudioUrl:
      "https://api.studio.thegraph.com/query/102093/gardens-v2---celo/version/latest",
    gardensGatewayId: "BsXEnGaXdj3CkGRn95bswGcv2mQX7m8kNq7M7WBxxPx8",
  },
} satisfies Record<
  number,
  {
    label: string;
    easGraphqlUrl: string;
    gardensStudioUrl: string;
    gardensGatewayId?: string;
  }
>;

type IncludeSource = "input" | "actions" | "gardens" | "works" | "assessments" | "hypercerts";

type SourceRecord = {
  sourceType: string;
  sourceId: string;
  reference: string;
  detail?: string;
};

type CollectedReference = {
  canonicalId: string;
  cid: string;
  path: string;
  canonicalUri: string;
  originalReferences: Set<string>;
  sources: SourceRecord[];
  expansionErrors: string[];
};

type FetchResult = {
  url: string;
  bytes: Uint8Array;
  contentType: string | null;
  text: string | null;
};

type CarFetchResult = {
  url: string;
  bytes: Uint8Array;
  contentType: string | null;
};

type PinResult = {
  pinStatus: "pinned" | "pin_failed";
  pinnedFrom?: string;
  pinnedRootCid?: string;
  pinMatchesExpected?: boolean;
  storachaGatewayUrl?: string;
  pinataGatewayUrl?: string;
  note?: string;
  pinError?: string;
  carByteLength?: number;
};

type AuditEntry = {
  canonicalId: string;
  canonicalUri: string;
  cid: string;
  path: string;
  sourceCount: number;
  sources: SourceRecord[];
  originalReferences: string[];
  fetchStatus: "reachable" | "failed";
  fetchedFrom?: string;
  contentType?: string | null;
  byteLength?: number;
  fetchError?: string;
  pinStatus: "audit_only" | "pinned" | "pin_failed";
  pinnedFrom?: string;
  pinnedRootCid?: string;
  pinMatchesExpected?: boolean;
  storachaGatewayUrl?: string;
  pinataGatewayUrl?: string;
  carByteLength?: number;
  pinError?: string;
  note?: string;
  expansionErrors?: string[];
};

type StorachaClient = Awaited<ReturnType<typeof create>>;

type JsonRecord = Record<string, unknown>;

type CarModule = {
  CarReader: {
    fromBytes(bytes: Uint8Array): Promise<{
      getRoots(): Promise<CID[]>;
    }>;
  };
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  bun scripts/repin-ipfs-media.ts --chain <id> [--input <refs.json|txt>] [--out <report.json>] [--include <comma-list>] [--audit-only]",
      "",
      "Examples:",
      "  bun scripts/repin-ipfs-media.ts --chain 42161",
      "  bun scripts/repin-ipfs-media.ts --chain 42161 --audit-only --input ./broken-refs.json",
      "",
      "Include values: input,actions,gardens,works,assessments,hypercerts",
      "Non-audit mode pins the original CID by fetching the existing DAG as CAR, uploading that CAR to Storacha, and syncing the CID to Pinata when PINATA_JWT is configured.",
    ].join("\n")
  );
  process.exit(1);
}

function resolveChainId(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !(parsed in CHAIN_CONFIGS)) {
    throw new Error(`Unsupported or missing chain id: ${value ?? "(empty)"}`);
  }
  return parsed;
}

function getGardensSubgraphUrl(chainId: number): string {
  const config = CHAIN_CONFIGS[chainId];
  const apiKey = process.env.VITE_GARDENS_SUBGRAPH_KEY?.trim();

  if (apiKey && config.gardensGatewayId) {
    return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${config.gardensGatewayId}`;
  }

  return config.gardensStudioUrl;
}

function trimLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, "");
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function isPotentialIpfsCid(value: string): boolean {
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z0-9]{20,})$/i.test(value);
}

function parseIpfsPath(value: string) {
  const sanitized = trimLeadingSlashes(value.trim()).replace(/^ipfs\//i, "");
  if (!sanitized) return null;

  const [cid, ...pathParts] = sanitized.split("/").filter(Boolean);
  if (!cid || !isPotentialIpfsCid(cid)) return null;

  const resolvedPath = pathParts.join("/");
  const canonicalId = resolvedPath ? `${cid}/${resolvedPath}` : cid;

  return {
    cid,
    path: resolvedPath,
    canonicalId,
    canonicalUri: `ipfs://${canonicalId}`,
  };
}

function parseIPFSReference(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("ipfs://")) {
    return parseIpfsPath(trimmed.slice("ipfs://".length));
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathname = trimLeadingSlashes(url.pathname);
      const subdomainMatch = url.hostname.match(/^([^.]+)\.ipfs\./i);

      if (pathname.startsWith("ipfs/")) {
        return parseIpfsPath(pathname.slice("ipfs/".length));
      }

      if (subdomainMatch?.[1]) {
        const cid = subdomainMatch[1];
        const resolvedPath = trimLeadingSlashes(pathname);
        return parseIpfsPath(resolvedPath ? `${cid}/${resolvedPath}` : cid);
      }
    } catch {
      return null;
    }
  }

  return parseIpfsPath(trimmed);
}

function getGatewayCandidates(reference: string): string[] {
  const parsed = parseIPFSReference(reference);
  if (!parsed) return [reference];

  const originalGateway =
    /^https?:\/\//i.test(reference.trim()) && parseIPFSReference(reference) ? reference.trim() : null;

  const bases = Array.from(
    new Set(
      [
        pinataConfig?.gatewayBaseUrl,
        process.env.VITE_STORACHA_GATEWAY?.trim(),
        ...DEFAULT_GATEWAYS,
      ]
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => trimTrailingSlashes(entry))
    )
  );

  return Array.from(
    new Set([originalGateway, ...bases.map((base) => `${base}/ipfs/${parsed.canonicalId}`)])
  ).filter((candidate): candidate is string => Boolean(candidate));
}

function getPathGatewayBase(reference: string): string | null {
  const trimmed = reference.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    const pathname = trimLeadingSlashes(url.pathname);
    return pathname.startsWith("ipfs/") ? trimTrailingSlashes(url.origin) : null;
  } catch {
    return null;
  }
}

function getCarGatewayCandidates(cid: string, originalReferences: Iterable<string>): string[] {
  const bases = Array.from(
    new Set(
      [
        ...Array.from(originalReferences, (reference) => getPathGatewayBase(reference)),
        process.env.VITE_STORACHA_GATEWAY?.trim(),
        ...DEFAULT_GATEWAYS,
      ]
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => trimTrailingSlashes(entry))
    )
  );

  return Array.from(
    new Set(
      bases.flatMap((base) => [
        `${base}/ipfs/${cid}?format=car&dag-scope=all`,
        `${base}/ipfs/${cid}?format=car`,
      ])
    )
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function tryParseJson<T = unknown>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 30_000,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function graphqlPost<TData>(
  url: string,
  query: string,
  variables: JsonRecord,
  operationName: string
): Promise<TData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables, operationName }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as {
      data?: TData;
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok || payload.errors?.length) {
      const message =
        payload.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
        `${response.status} ${response.statusText}`;
      throw new Error(`${operationName} failed: ${message}`);
    }

    if (!payload.data) {
      throw new Error(`${operationName} returned no data.`);
    }

    return payload.data;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchReference(reference: string): Promise<FetchResult> {
  const candidates = getGatewayCandidates(reference);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate, 30_000);
      if (!response.ok) {
        lastError = new Error(`${response.status} ${response.statusText}`);
        continue;
      }

      const contentType = response.headers.get("content-type");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text =
        contentType?.includes("json") || contentType?.startsWith("text/")
          ? TEXT_DECODER.decode(bytes)
          : null;

      return {
        url: candidate,
        bytes,
        contentType,
        text,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Unable to fetch ${reference}`);
}

let carModulePromise: Promise<CarModule> | null = null;

async function loadCarModule(): Promise<CarModule> {
  if (!carModulePromise) {
    carModulePromise = import("@ipld/car")
      .catch(async () => {
        const fallbackPath = path.resolve(REPO_ROOT, "node_modules/.bun/node_modules/@ipld/car/src/index.js");
        return import(pathToFileURL(fallbackPath).href);
      })
      .then((module) => module as CarModule);
  }

  return carModulePromise;
}

function cidsMatch(left: CID | string, right: CID | string): boolean {
  const leftCid = typeof left === "string" ? CID.parse(left) : left;
  const rightCid = typeof right === "string" ? CID.parse(right) : right;

  if (leftCid.code !== rightCid.code) return false;
  if (leftCid.multihash.bytes.length !== rightCid.multihash.bytes.length) return false;

  return leftCid.multihash.bytes.every((byte, index) => byte === rightCid.multihash.bytes[index]);
}

async function fetchCarForCid(cid: string, originalReferences: Iterable<string>): Promise<CarFetchResult> {
  const candidates = getCarGatewayCandidates(cid, originalReferences);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate, 60_000, {
        headers: { accept: CAR_CONTENT_TYPE },
      });
      if (!response.ok) {
        lastError = new Error(`${response.status} ${response.statusText}`);
        continue;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        lastError = new Error(`Received an empty CAR payload from ${candidate}`);
        continue;
      }

      return {
        url: candidate,
        bytes,
        contentType: response.headers.get("content-type"),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Unable to fetch a CAR for ${cid}`);
}

async function validateCarRoot(carBytes: Uint8Array, expectedCid: string): Promise<CID> {
  const carModule = await loadCarModule();
  const reader = await carModule.CarReader.fromBytes(carBytes);
  const roots = await reader.getRoots();
  if (roots.length === 0) {
    throw new Error("Fetched CAR has no roots.");
  }

  const matchedRoot = roots.find((root) => cidsMatch(root, expectedCid));
  if (!matchedRoot) {
    throw new Error(
      `Fetched CAR roots do not include ${expectedCid}. Roots: ${roots.map((root) => root.toString()).join(", ")}`
    );
  }

  return matchedRoot;
}

async function pinOriginalCid(
  entry: CollectedReference,
  storachaClient: StorachaClient,
  pinCache: Map<string, Promise<PinResult>>
): Promise<PinResult> {
  const existing = pinCache.get(entry.cid);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    try {
      const car = await fetchCarForCid(entry.cid, entry.originalReferences);
      await validateCarRoot(car.bytes, entry.cid);

      const upload = await storachaClient.uploadCAR(
        new Blob([car.bytes], { type: car.contentType ?? CAR_CONTENT_TYPE })
      );
      const pinnedRootCid = upload.toString();
      const pinMatchesExpected = cidsMatch(pinnedRootCid, entry.cid);
      const availability = await ensureHybridCidAvailability(entry.cid, {
        storachaGatewayBaseUrl:
          process.env.VITE_STORACHA_GATEWAY?.trim() || "https://storacha.link",
        pinataConfig,
        name: entry.canonicalId,
        metadata: {
          source: "repin-ipfs-media",
          cid: entry.cid,
        },
      });

      return {
        pinStatus: "pinned" as const,
        pinnedFrom: car.url,
        pinnedRootCid,
        pinMatchesExpected,
        storachaGatewayUrl: availability.storachaUrl,
        pinataGatewayUrl: availability.pinataUrl,
        carByteLength: car.bytes.byteLength,
        note: pinMatchesExpected
          ? availability.pinataUrl
            ? "Pinned the original DAG via CAR, verified Storacha, and synced the CID to Pinata."
            : "Pinned the original DAG via CAR and verified Storacha without changing the root CID."
          : "Storacha accepted the CAR, but the reported root CID differs from the expected CID. Review before marking this complete.",
      };
    } catch (error) {
      return {
        pinStatus: "pin_failed" as const,
        pinError: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  pinCache.set(entry.cid, task);
  return task;
}

function parseInputReferences(raw: string, inputPath: string): string[] {
  if (path.extname(inputPath).toLowerCase() === ".json") {
    const parsed = JSON.parse(raw) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.references)
        ? parsed.references
        : null;

    if (!items) {
      throw new Error(
        'Input JSON must be an array or an object shaped like { "references": [...] }.'
      );
    }

    return items.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (isRecord(item)) {
        const value = item.reference ?? item.cid ?? item.url;
        return typeof value === "string" ? [value] : [];
      }
      return [];
    });
  }

  return raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectIpfsStrings(value: unknown, pointer = "$"): Array<{ pointer: string; value: string }> {
  if (typeof value === "string") {
    return parseIPFSReference(value) ? [{ pointer, value }] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectIpfsStrings(entry, `${pointer}[${index}]`));
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectIpfsStrings(entry, `${pointer}.${key}`)
    );
  }

  return [];
}

function shouldExpandNestedJson(pointer: string, reference: string): boolean {
  if (/metadata|config|instruction|uri|json/i.test(pointer)) return true;

  const parsed = parseIPFSReference(reference);
  if (!parsed?.path) return false;

  return parsed.path.toLowerCase().endsWith(".json");
}

async function initStorachaClient(): Promise<StorachaClient> {
  const key = process.env.VITE_STORACHA_KEY?.trim();
  const proof = process.env.VITE_STORACHA_PROOF?.trim();

  if (!key || !proof) {
    throw new Error(
      "Storacha credentials are missing. Set VITE_STORACHA_KEY and VITE_STORACHA_PROOF."
    );
  }

  const principal = Signer.parse(key);
  const client = await create({ principal });
  const delegation = await parseProof(proof);
  const space = await client.addSpace(delegation);
  await client.setCurrentSpace(space.did());
  return client;
}

async function loadDeployment(chainId: number): Promise<{
  schemas?: {
    assessmentSchemaUID?: string;
    workSchemaUID?: string;
  };
}> {
  const deploymentPath = path.resolve(
    `packages/contracts/deployments/${chainId.toString()}-latest.json`
  );
  const file = await readFile(deploymentPath, "utf8");
  return JSON.parse(file) as {
    schemas?: {
      assessmentSchemaUID?: string;
      workSchemaUID?: string;
    };
  };
}

function addReference(
  collected: Map<string, CollectedReference>,
  reference: string,
  source: SourceRecord
): CollectedReference | null {
  const parsed = parseIPFSReference(reference);
  if (!parsed) return null;

  let entry = collected.get(parsed.canonicalId);
  if (!entry) {
    entry = {
      canonicalId: parsed.canonicalId,
      cid: parsed.cid,
      path: parsed.path,
      canonicalUri: parsed.canonicalUri,
      originalReferences: new Set<string>(),
      sources: [],
      expansionErrors: [],
    };
    collected.set(parsed.canonicalId, entry);
  }

  entry.originalReferences.add(reference);
  entry.sources.push(source);
  return entry;
}

async function expandJsonReference(
  collected: Map<string, CollectedReference>,
  expandedJson: Set<string>,
  reference: string,
  source: SourceRecord,
  depth = 0
) {
  if (depth > 2) return;

  const parsed = parseIPFSReference(reference);
  if (!parsed || expandedJson.has(parsed.canonicalId)) {
    return;
  }

  expandedJson.add(parsed.canonicalId);

  try {
    const fetched = await fetchReference(reference);
    const text = fetched.text ?? TEXT_DECODER.decode(fetched.bytes);
    const payload = tryParseJson(text);
    if (!payload) return;

    const nested = collectIpfsStrings(payload);
    for (const item of nested) {
      const entry = addReference(collected, item.value, {
        sourceType: `${source.sourceType}:json`,
        sourceId: source.sourceId,
        reference: item.value,
        detail: item.pointer,
      });

      if (entry && shouldExpandNestedJson(item.pointer, item.value)) {
        await expandJsonReference(
          collected,
          expandedJson,
          item.value,
          {
            sourceType: `${source.sourceType}:json`,
            sourceId: source.sourceId,
            reference: item.value,
            detail: item.pointer,
          },
          depth + 1
        );
      }
    }
  } catch (error) {
    const entry = addReference(collected, reference, source);
    entry?.expansionErrors.push(error instanceof Error ? error.message : String(error));
  }
}

async function collectInputReferences(
  collected: Map<string, CollectedReference>,
  inputPath: string
) {
  const file = await readFile(inputPath, "utf8");
  const references = parseInputReferences(file, inputPath);

  for (const reference of references) {
    addReference(collected, reference, {
      sourceType: "input",
      sourceId: path.basename(inputPath),
      reference,
    });
  }
}

async function collectActionReferences(
  collected: Map<string, CollectedReference>,
  expandedJson: Set<string>,
  chainId: number
) {
  const data = await graphqlPost<{
    Action?: Array<{ id: string; title?: string; media?: string[] | null; instructions?: string | null }>;
  }>(
    DEFAULT_INDEXER_URL,
    `
      query ActionAssets($chainId: Int!) {
        Action(where: { chainId: { _eq: $chainId } }) {
          id
          title
          media
          instructions
        }
      }
    `,
    { chainId },
    "ActionAssets"
  );

  for (const action of data.Action ?? []) {
    for (const media of action.media ?? []) {
      addReference(collected, media, {
        sourceType: "actions",
        sourceId: action.id,
        reference: media,
        detail: action.title,
      });
    }

    if (action.instructions) {
      addReference(collected, action.instructions, {
        sourceType: "actions",
        sourceId: action.id,
        reference: action.instructions,
        detail: `${action.title ?? "action"} instructions`,
      });
      await expandJsonReference(
        collected,
        expandedJson,
        action.instructions,
        {
          sourceType: "actions",
          sourceId: action.id,
          reference: action.instructions,
          detail: `${action.title ?? "action"} instructions`,
        },
        0
      );
    }
  }
}

async function collectGardenReferences(
  collected: Map<string, CollectedReference>,
  chainId: number
) {
  const data = await graphqlPost<{
    Garden?: Array<{ id: string; name?: string | null; bannerImage?: string | null }>;
  }>(
    DEFAULT_INDEXER_URL,
    `
      query GardenAssets($chainId: Int!) {
        Garden(where: { chainId: { _eq: $chainId } }) {
          id
          name
          bannerImage
        }
      }
    `,
    { chainId },
    "GardenAssets"
  );

  for (const garden of data.Garden ?? []) {
    if (!garden.bannerImage) continue;

    addReference(collected, garden.bannerImage, {
      sourceType: "gardens",
      sourceId: garden.id,
      reference: garden.bannerImage,
      detail: garden.name ?? undefined,
    });
  }
}

function readDecodedField(decodedDataJson: string, name: string): unknown {
  const parsed = tryParseJson<Array<{ name?: string; value?: { value?: unknown } }>>(decodedDataJson);
  if (!Array.isArray(parsed)) return undefined;

  return parsed.find((field) => field.name === name)?.value?.value;
}

async function collectWorkReferences(
  collected: Map<string, CollectedReference>,
  expandedJson: Set<string>,
  chainId: number,
  workSchemaUid: string
) {
  if (!workSchemaUid) return;

  const data = await graphqlPost<{
    attestations?: Array<{
      id: string;
      decodedDataJson: string;
    }>;
  }>(
    CHAIN_CONFIGS[chainId].easGraphqlUrl,
    `
      query WorkAttestations($where: AttestationWhereInput) {
        attestations(where: $where) {
          id
          decodedDataJson
        }
      }
    `,
    {
      where: {
        schemaId: { equals: workSchemaUid },
        revoked: { equals: false },
      },
    },
    "WorkAttestations"
  );

  for (const attestation of data.attestations ?? []) {
    const media = readDecodedField(attestation.decodedDataJson, "media");
    const metadata = readDecodedField(attestation.decodedDataJson, "metadata");

    if (Array.isArray(media)) {
      for (const item of media) {
        if (typeof item !== "string") continue;
        addReference(collected, item, {
          sourceType: "works",
          sourceId: attestation.id,
          reference: item,
          detail: "media",
        });
      }
    }

    if (typeof metadata === "string" && metadata.trim().length > 0) {
      addReference(collected, metadata, {
        sourceType: "works",
        sourceId: attestation.id,
        reference: metadata,
        detail: "metadata",
      });
      await expandJsonReference(
        collected,
        expandedJson,
        metadata,
        {
          sourceType: "works",
          sourceId: attestation.id,
          reference: metadata,
          detail: "metadata",
        },
        0
      );
    }
  }
}

async function collectAssessmentReferences(
  collected: Map<string, CollectedReference>,
  expandedJson: Set<string>,
  chainId: number,
  assessmentSchemaUid: string
) {
  if (!assessmentSchemaUid) return;

  const data = await graphqlPost<{
    attestations?: Array<{
      id: string;
      decodedDataJson: string;
    }>;
  }>(
    CHAIN_CONFIGS[chainId].easGraphqlUrl,
    `
      query AssessmentAttestations($where: AttestationWhereInput) {
        attestations(where: $where) {
          id
          decodedDataJson
        }
      }
    `,
    {
      where: {
        schemaId: { equals: assessmentSchemaUid },
        revoked: { equals: false },
      },
    },
    "AssessmentAttestations"
  );

  for (const attestation of data.attestations ?? []) {
    const assessmentConfig = readDecodedField(attestation.decodedDataJson, "assessmentConfigCID");
    if (typeof assessmentConfig !== "string" || assessmentConfig.trim().length === 0) {
      continue;
    }

    addReference(collected, assessmentConfig, {
      sourceType: "assessments",
      sourceId: attestation.id,
      reference: assessmentConfig,
      detail: "assessmentConfigCID",
    });
    await expandJsonReference(
      collected,
      expandedJson,
      assessmentConfig,
      {
        sourceType: "assessments",
        sourceId: attestation.id,
        reference: assessmentConfig,
        detail: "assessmentConfigCID",
      },
      0
    );
  }
}

async function collectHypercertReferences(
  collected: Map<string, CollectedReference>,
  expandedJson: Set<string>,
  chainId: number
) {
  const data = await graphqlPost<{
    Hypercert?: Array<{ id: string; metadataUri?: string | null }>;
  }>(
    DEFAULT_INDEXER_URL,
    `
      query HypercertAssets($chainId: Int!) {
        Hypercert(where: { chainId: { _eq: $chainId } }) {
          id
          metadataUri
        }
      }
    `,
    { chainId },
    "HypercertAssets"
  );

  for (const hypercert of data.Hypercert ?? []) {
    if (!hypercert.metadataUri) continue;

    addReference(collected, hypercert.metadataUri, {
      sourceType: "hypercerts",
      sourceId: hypercert.id,
      reference: hypercert.metadataUri,
      detail: "metadataUri",
    });
    await expandJsonReference(
      collected,
      expandedJson,
      hypercert.metadataUri,
      {
        sourceType: "hypercerts",
        sourceId: hypercert.id,
        reference: hypercert.metadataUri,
        detail: "metadataUri",
      },
      0
    );
  }
}

async function auditAndRepin(
  collected: Map<string, CollectedReference>,
  auditOnly: boolean
): Promise<AuditEntry[]> {
  const entries = Array.from(collected.values()).sort((left, right) =>
    left.canonicalId.localeCompare(right.canonicalId)
  );
  const results: AuditEntry[] = [];
  const storachaClient = auditOnly ? null : await initStorachaClient();
  const pinCache = new Map<string, Promise<PinResult>>();

  for (const entry of entries) {
    let fetchStatus: AuditEntry["fetchStatus"] = "failed";
    let fetchedFrom: string | undefined;
    let contentType: string | null | undefined;
    let byteLength: number | undefined;
    let fetchError: string | undefined;

    try {
      const fetched = await fetchReference(
        entry.originalReferences.values().next().value ?? entry.canonicalUri
      );
      fetchStatus = "reachable";
      fetchedFrom = fetched.url;
      contentType = fetched.contentType;
      byteLength = fetched.bytes.byteLength;
    } catch (error) {
      fetchError = error instanceof Error ? error.message : String(error);
    }

    if (auditOnly) {
      results.push({
        canonicalId: entry.canonicalId,
        canonicalUri: entry.canonicalUri,
        cid: entry.cid,
        path: entry.path,
        sourceCount: entry.sources.length,
        sources: entry.sources,
        originalReferences: Array.from(entry.originalReferences),
        fetchStatus,
        fetchedFrom,
        contentType,
        byteLength,
        fetchError,
        pinStatus: "audit_only",
        expansionErrors: entry.expansionErrors,
      });
      continue;
    }

    const pinResult = await pinOriginalCid(entry, storachaClient!, pinCache);
    results.push({
      canonicalId: entry.canonicalId,
      canonicalUri: entry.canonicalUri,
      cid: entry.cid,
      path: entry.path,
      sourceCount: entry.sources.length,
      sources: entry.sources,
      originalReferences: Array.from(entry.originalReferences),
      fetchStatus,
      fetchedFrom,
      contentType,
      byteLength,
      fetchError,
      pinStatus: pinResult.pinStatus,
      pinnedFrom: pinResult.pinnedFrom,
      pinnedRootCid: pinResult.pinnedRootCid,
      pinMatchesExpected: pinResult.pinMatchesExpected,
      storachaGatewayUrl: pinResult.storachaGatewayUrl,
      pinataGatewayUrl: pinResult.pinataGatewayUrl,
      carByteLength: pinResult.carByteLength,
      pinError: pinResult.pinError,
      note: pinResult.note,
      expansionErrors: entry.expansionErrors,
    });
  }

  return results;
}

async function main() {
  const { values } = parseArgs({
    options: {
      chain: { type: "string" },
      input: { type: "string" },
      out: { type: "string" },
      include: { type: "string" },
      "audit-only": { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (!values.chain) usage();

  const chainId = resolveChainId(values.chain);
  const include = new Set<IncludeSource>(
    (values.include?.split(",") ?? ["actions", "gardens", "works", "assessments", "hypercerts"])
      .map((value) => value.trim())
      .filter(Boolean) as IncludeSource[]
  );
  const inputPath = values.input ? path.resolve(values.input) : null;
  const outPath = path.resolve(
    values.out ?? `reports/ipfs-repin-${chainId}-${Date.now()}.json`
  );
  const auditOnly = Boolean(values["audit-only"]);
  const deployment = await loadDeployment(chainId);

  const collected = new Map<string, CollectedReference>();
  const expandedJson = new Set<string>();

  if (inputPath) {
    await collectInputReferences(collected, inputPath);
  }

  if (include.has("actions")) {
    await collectActionReferences(collected, expandedJson, chainId);
  }

  if (include.has("gardens")) {
    await collectGardenReferences(collected, chainId);
  }

  if (include.has("works")) {
    await collectWorkReferences(collected, expandedJson, chainId, deployment.schemas?.workSchemaUID ?? "");
  }

  if (include.has("assessments")) {
    await collectAssessmentReferences(
      collected,
      expandedJson,
      chainId,
      deployment.schemas?.assessmentSchemaUID ?? ""
    );
  }

  if (include.has("hypercerts")) {
    await collectHypercertReferences(collected, expandedJson, chainId);
  }

  const audit = await auditAndRepin(collected, auditOnly);
  const summary = {
    discoveredReferences: audit.length,
    reachableReferences: audit.filter((entry) => entry.fetchStatus === "reachable").length,
    fetchFailures: audit.filter((entry) => entry.fetchStatus === "failed").length,
    pinned: audit.filter((entry) => entry.pinStatus === "pinned").length,
    pinFailures: audit.filter((entry) => entry.pinStatus === "pin_failed").length,
    auditOnly: audit.filter((entry) => entry.pinStatus === "audit_only").length,
    pinataVerified: audit.filter((entry) => Boolean(entry.pinataGatewayUrl)).length,
    cidMismatches: audit.filter(
      (entry) => entry.pinStatus === "pinned" && entry.pinMatchesExpected === false
    ).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    chainId,
    network: CHAIN_CONFIGS[chainId].label,
    auditOnly,
    inputPath,
    endpoints: {
      indexer: DEFAULT_INDEXER_URL,
      eas: CHAIN_CONFIGS[chainId].easGraphqlUrl,
      gardensSubgraph: getGardensSubgraphUrl(chainId),
      pinataGateway: pinataConfig?.gatewayBaseUrl ?? null,
    },
    summary,
    references: audit,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2));

  console.log(
    [
      `IPFS audit complete for ${CHAIN_CONFIGS[chainId].label} (${chainId}).`,
      `Discovered references: ${summary.discoveredReferences}`,
      `Reachable: ${summary.reachableReferences}`,
      `Pinned: ${summary.pinned}`,
      `Pin failures: ${summary.pinFailures}`,
      `Pinata verified: ${summary.pinataVerified}`,
      `Fetch failures: ${summary.fetchFailures}`,
      `Output: ${outPath}`,
    ].join("\n")
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
