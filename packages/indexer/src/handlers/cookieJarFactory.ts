import { CookieJarFactory } from "../../generated";

import type { CampaignCookieJar, HandlerTypes_handlerArgs } from "../../generated/src/Types.gen";

import { getCampaignCookieJarId, getTxHash, normalizeAddress } from "./shared";

const CAMPAIGN_METADATA_KIND = "green-goods.campaign-cookie-jar";
const CAMPAIGN_METADATA_VERSION = 1;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const CREATE_COOKIE_JAR_SELECTOR = "0x203d4c12";
const ABI_WORD_HEX_LENGTH = 64;
const JAR_CONFIG_METADATA_SLOT = 14;

interface JarCreatedArgs {
  jarAddress: string;
  creator: string;
}

interface MetadataUpdatedArgs {
  jarAddress: string;
  metadata: string;
}

interface ParsedCampaignMetadata {
  rawMetadata: string;
  metadataKind?: string;
  metadataVersion?: number;
  slug?: string;
  title?: string;
  sourceGardens: string[];
  operatorPolicy?: string;
  extraAllowlist: string[];
  isValidCampaign: boolean;
}

function normalizeAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string" || !ADDRESS_PATTERN.test(candidate)) continue;
    const normalized = normalizeAddress(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    addresses.push(normalized);
  }

  return addresses;
}

function parseCampaignMetadata(rawMetadata: string): ParsedCampaignMetadata {
  try {
    const parsed = JSON.parse(rawMetadata) as Record<string, unknown>;
    const metadataKind = typeof parsed.kind === "string" ? parsed.kind : undefined;
    const metadataVersion =
      typeof parsed.version === "number" && Number.isFinite(parsed.version)
        ? parsed.version
        : undefined;
    const slug = typeof parsed.slug === "string" ? parsed.slug.trim() : undefined;
    const title = typeof parsed.title === "string" ? parsed.title.trim() : undefined;
    const sourceGardens = normalizeAddressList(parsed.sourceGardens);
    const operatorPolicy =
      parsed.operatorPolicy === "one-operator-per-garden" ? "one-operator-per-garden" : undefined;
    const extraAllowlist = normalizeAddressList(parsed.extraAllowlist);
    const isValidCampaign =
      metadataKind === CAMPAIGN_METADATA_KIND &&
      metadataVersion === CAMPAIGN_METADATA_VERSION &&
      Boolean(slug) &&
      Boolean(title);

    return {
      rawMetadata,
      metadataKind,
      metadataVersion,
      slug,
      title,
      sourceGardens,
      operatorPolicy,
      extraAllowlist,
      isValidCampaign,
    };
  } catch {
    return {
      rawMetadata,
      sourceGardens: [],
      extraAllowlist: [],
      isValidCampaign: false,
    };
  }
}

function readAbiWord(data: string, offsetBytes: number): bigint | null {
  const start = offsetBytes * 2;
  const word = data.slice(start, start + ABI_WORD_HEX_LENGTH);
  if (word.length !== ABI_WORD_HEX_LENGTH || !/^[a-fA-F0-9]+$/.test(word)) return null;
  return BigInt(`0x${word}`);
}

function toSafeAbiOffset(value: bigint | null): number | null {
  if (value === null || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

function readAbiString(data: string, offsetBytes: number): string | null {
  const byteLength = toSafeAbiOffset(readAbiWord(data, offsetBytes));
  if (byteLength === null) return null;

  const start = (offsetBytes + 32) * 2;
  const end = start + byteLength * 2;
  const bytes = data.slice(start, end);
  if (bytes.length !== byteLength * 2 || !/^[a-fA-F0-9]*$/.test(bytes)) return null;

  return Buffer.from(bytes, "hex").toString("utf8");
}

function decodeCreateCookieJarMetadata(transaction: unknown): ParsedCampaignMetadata | undefined {
  const input =
    typeof transaction === "object" &&
    transaction !== null &&
    "input" in transaction &&
    typeof transaction.input === "string"
      ? transaction.input
      : undefined;
  if (!input?.toLowerCase().startsWith(CREATE_COOKIE_JAR_SELECTOR)) return undefined;

  const encodedArgs = input.slice(CREATE_COOKIE_JAR_SELECTOR.length);
  if (encodedArgs.length < ABI_WORD_HEX_LENGTH) return undefined;

  const jarConfigOffset = toSafeAbiOffset(readAbiWord(encodedArgs, 0));
  if (jarConfigOffset === null) return undefined;

  const metadataRelativeOffset = toSafeAbiOffset(
    readAbiWord(encodedArgs, jarConfigOffset + JAR_CONFIG_METADATA_SLOT * 32)
  );
  if (metadataRelativeOffset === null) return undefined;

  const metadata = readAbiString(encodedArgs, jarConfigOffset + metadataRelativeOffset);
  return metadata ? parseCampaignMetadata(metadata) : undefined;
}

function buildCampaignCookieJarCandidate(params: {
  event: {
    chainId: number;
    srcAddress: string;
    block: { timestamp: number };
    transaction: unknown;
  };
  existing?: CampaignCookieJar;
  jarAddress: string;
  creator?: string;
  metadata?: ParsedCampaignMetadata;
}): CampaignCookieJar {
  const normalizedJar = normalizeAddress(params.jarAddress);
  const existing = params.existing;
  const metadata = params.metadata;

  return {
    id: getCampaignCookieJarId(params.event.chainId, normalizedJar),
    chainId: params.event.chainId,
    factoryAddress: normalizeAddress(params.event.srcAddress),
    jarAddress: normalizedJar,
    creator: params.creator ? normalizeAddress(params.creator) : (existing?.creator ?? ""),
    rawMetadata: metadata?.rawMetadata ?? existing?.rawMetadata ?? "",
    metadataKind: metadata?.metadataKind ?? existing?.metadataKind,
    metadataVersion: metadata?.metadataVersion ?? existing?.metadataVersion,
    slug: metadata?.slug ?? existing?.slug,
    title: metadata?.title ?? existing?.title,
    sourceGardens: metadata?.sourceGardens ?? existing?.sourceGardens ?? [],
    operatorPolicy: metadata?.operatorPolicy ?? existing?.operatorPolicy,
    extraAllowlist: metadata?.extraAllowlist ?? existing?.extraAllowlist ?? [],
    isValidCampaign: metadata?.isValidCampaign ?? existing?.isValidCampaign ?? false,
    createdAt: existing?.createdAt ?? params.event.block.timestamp,
    metadataUpdatedAt:
      metadata !== undefined ? params.event.block.timestamp : (existing?.metadataUpdatedAt ?? 0),
    txHash: existing?.txHash ?? getTxHash(params.event.transaction),
  };
}

CookieJarFactory.JarCreated.handler(
  async ({ event, context }: HandlerTypes_handlerArgs<JarCreatedArgs, void>) => {
    const jarAddress = normalizeAddress(event.params.jarAddress);
    const id = getCampaignCookieJarId(event.chainId, jarAddress);
    const existing = await context.CampaignCookieJar.get(id);

    context.CampaignCookieJar.set(
      buildCampaignCookieJarCandidate({
        event,
        existing,
        jarAddress,
        creator: event.params.creator,
        metadata: decodeCreateCookieJarMetadata(event.transaction),
      })
    );
  }
);

CookieJarFactory.MetadataUpdated.handler(
  async ({ event, context }: HandlerTypes_handlerArgs<MetadataUpdatedArgs, void>) => {
    const jarAddress = normalizeAddress(event.params.jarAddress);
    const id = getCampaignCookieJarId(event.chainId, jarAddress);
    const existing = await context.CampaignCookieJar.get(id);

    context.CampaignCookieJar.set(
      buildCampaignCookieJarCandidate({
        event,
        existing,
        jarAddress,
        metadata: parseCampaignMetadata(event.params.metadata),
      })
    );
  }
);
