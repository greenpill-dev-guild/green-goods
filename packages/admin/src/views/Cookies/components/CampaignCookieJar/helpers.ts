import type { Address, Garden } from "@green-goods/shared/types/domain";
import { parseUnits } from "viem";

export const PUBLIC_COOKIE_BASE_URL = "https://greengoods.app/cookies";

export function parseAmountInput(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

export function publicJarLink(jarAddress: Address): string {
  return `${PUBLIC_COOKIE_BASE_URL}?jar=${jarAddress}`;
}

export function haveSameAddressSet(left: readonly Address[], right: readonly Address[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map((address) => address.toLowerCase()));
  return left.every((address) => rightKeys.has(address.toLowerCase()));
}

export function normalizeMetadataField(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function gardensForAggregation(gardens: readonly Garden[]) {
  return gardens.map((garden) => ({
    id: garden.id,
    name: garden.name,
    operators: garden.operators,
  }));
}

export function formatCampaignDate(seconds: number | undefined, locale: string): string | null {
  if (!seconds) return null;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(seconds * 1000);
}

export function formatSourceGardens(
  sourceGardens: readonly Address[],
  gardensByAddress: Map<string, Garden>
): string {
  if (sourceGardens.length === 0) return "";
  const names = sourceGardens
    .map((address) => gardensByAddress.get(address.toLowerCase())?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return `${sourceGardens.length} gardens`;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} more`;
}
