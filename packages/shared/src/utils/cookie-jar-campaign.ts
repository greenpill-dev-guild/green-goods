import { getAddress, isAddress } from "viem";
import { derivePublicGardenSlug } from "../public-contracts";
import type { Address } from "../types/domain";
import type {
  CampaignCookieJarMetadata,
  CampaignCookieJarOperatorAggregation,
  CampaignCookieJarOperatorSource,
  CookieJarWithdrawalType,
} from "../types/cookie-jar";

const METADATA_KIND = "green-goods.campaign-cookie-jar";

export function normalizeCampaignAddress(value: string): Address | null {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) return null;
  return getAddress(trimmed) as Address;
}

export function parseCampaignAddressList(input: string): {
  addresses: Address[];
  invalidAddresses: string[];
} {
  const tokens = input
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const addresses: Address[] = [];
  const invalidAddresses: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const normalized = normalizeCampaignAddress(token);
    if (!normalized) {
      invalidAddresses.push(token);
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(normalized);
  }

  return { addresses, invalidAddresses };
}

function dedupeAddresses(addresses: readonly Address[]): Address[] {
  const seen = new Set<string>();
  const result: Address[] = [];
  for (const address of addresses) {
    const normalized = normalizeCampaignAddress(address);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export interface CampaignGardenOperatorInput {
  id: string;
  name: string;
  operators?: readonly Address[];
}

export function aggregateCampaignCookieJarOperators({
  gardens,
  selectedGardenIds,
  extraAddressesInput = "",
}: {
  gardens: readonly CampaignGardenOperatorInput[];
  selectedGardenIds: readonly string[];
  extraAddressesInput?: string;
}): CampaignCookieJarOperatorAggregation {
  const selectedKeys = new Set(selectedGardenIds.map((id) => id.toLowerCase()));
  const { addresses: extraAllowlist, invalidAddresses } =
    parseCampaignAddressList(extraAddressesInput);
  const sources: CampaignCookieJarOperatorSource[] = gardens
    .filter((garden) => selectedKeys.has(garden.id.toLowerCase()))
    .map((garden) => {
      const operators = dedupeAddresses(garden.operators ?? []);
      return {
        gardenAddress: normalizeCampaignAddress(garden.id) ?? (garden.id as Address),
        gardenName: garden.name,
        gardenSlug: derivePublicGardenSlug(garden.name, garden.id),
        operators,
        selectedOperator: operators[0] ?? null,
      };
    });

  const operatorAllowlist = sources
    .map((source) => source.selectedOperator)
    .filter((address): address is Address => Boolean(address));
  const allowlist = dedupeAddresses([...operatorAllowlist, ...extraAllowlist]);

  return {
    allowlist,
    invalidAddresses,
    sources,
    missingOperatorGardens: sources.filter((source) => source.selectedOperator === null),
    extraAllowlist,
  };
}

export function buildCampaignCookieJarMetadata(params: {
  title: string;
  slug: string;
  sourceGardens: readonly Address[];
  extraAllowlist: readonly Address[];
  chainId: number;
  createdAt?: number;
}): CampaignCookieJarMetadata {
  return {
    kind: METADATA_KIND,
    version: 1,
    title: params.title.trim(),
    slug: params.slug.trim(),
    sourceGardens: dedupeAddresses(params.sourceGardens),
    operatorPolicy: "one-operator-per-garden",
    extraAllowlist: dedupeAddresses(params.extraAllowlist),
    chainId: params.chainId,
    createdAt: params.createdAt ?? Math.floor(Date.now() / 1000),
  };
}

export function deriveCampaignCookieJarClaimState(params: {
  hasConnectedUser: boolean;
  isEligible: boolean;
  isPaused: boolean;
  withdrawalType: CookieJarWithdrawalType;
  fixedAmount: bigint;
  maxWithdrawal: bigint;
  balance: bigint;
  oneTimeWithdrawal: boolean;
  totalWithdrawn: bigint;
  withdrawalInterval: bigint;
  lastWithdrawalTime: bigint;
  now?: number;
}): { canClaimNow: boolean; nextClaimAt: number | null } {
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const nextClaimAt =
    params.withdrawalInterval > 0n && params.lastWithdrawalTime > 0n
      ? Number(params.lastWithdrawalTime + params.withdrawalInterval)
      : null;
  const cooldownReady = !nextClaimAt || nextClaimAt <= now;
  const configuredAmountReady =
    params.withdrawalType === "fixed"
      ? params.fixedAmount > 0n && params.balance >= params.fixedAmount
      : params.withdrawalType === "variable"
        ? params.maxWithdrawal > 0n && params.balance > 0n
        : false;

  return {
    canClaimNow:
      params.hasConnectedUser &&
      params.isEligible &&
      !params.isPaused &&
      configuredAmountReady &&
      (!params.oneTimeWithdrawal || params.totalWithdrawn === 0n) &&
      cooldownReady,
    nextClaimAt: cooldownReady ? null : nextClaimAt,
  };
}

export function parseCampaignCookieJarMetadata(
  raw: string | undefined
): CampaignCookieJarMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CampaignCookieJarMetadata>;
    if (
      parsed.kind !== METADATA_KIND ||
      parsed.version !== 1 ||
      typeof parsed.slug !== "string" ||
      typeof parsed.title !== "string"
    ) {
      return null;
    }
    return {
      kind: METADATA_KIND,
      version: 1,
      slug: parsed.slug,
      title: parsed.title,
      sourceGardens: dedupeAddresses((parsed.sourceGardens ?? []) as Address[]),
      operatorPolicy: "one-operator-per-garden",
      extraAllowlist: dedupeAddresses((parsed.extraAllowlist ?? []) as Address[]),
      chainId: Number(parsed.chainId ?? 0),
      createdAt: Number(parsed.createdAt ?? 0),
    };
  } catch {
    return null;
  }
}

export function diffCampaignCookieJarAllowlist({
  current,
  desired,
}: {
  current: readonly Address[];
  desired: readonly Address[];
}) {
  const currentMap = new Map(current.map((address) => [address.toLowerCase(), address]));
  const desiredMap = new Map(desired.map((address) => [address.toLowerCase(), address]));

  return {
    grant: Array.from(desiredMap.entries())
      .filter(([key]) => !currentMap.has(key))
      .map(([, address]) => address),
    revoke: Array.from(currentMap.entries())
      .filter(([key]) => !desiredMap.has(key))
      .map(([, address]) => address),
  };
}
