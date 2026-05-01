import { CookieJarFactory } from "../../generated";

import type { CampaignCookieJar, HandlerTypes_handlerArgs } from "../../generated/src/Types.gen";

import { getCampaignCookieJarId, getTxHash, normalizeAddress } from "./shared";

const CAMPAIGN_METADATA_KIND = "green-goods.campaign-cookie-jar";
const CAMPAIGN_METADATA_VERSION = 1;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

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
