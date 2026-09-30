import type { Enum } from "envio";

import {
  CAPITAL_TYPE_MAP,
  DOMAIN_TYPE_MAP,
  ENS_NAME_TYPE_MAP,
  POOL_TYPE_MAP,
  WEIGHT_SCHEME_MAP,
} from "./constants";

type Capital = Enum<"Capital">;
type Domain = Enum<"Domain">;
type PoolType = Enum<"PoolType">;
type WeightScheme = Enum<"WeightScheme">;

export function mapDomainType(value: bigint): Domain {
  return DOMAIN_TYPE_MAP[Number(value)] ?? "UNKNOWN";
}

export function expandDomainMask(mask: number): Domain[] {
  const domains: Domain[] = [];
  if (mask & 1) domains.push("SOLAR");
  if (mask & 2) domains.push("AGRO");
  if (mask & 4) domains.push("EDU");
  if (mask & 8) domains.push("WASTE");
  return domains;
}

export function mapCapitalType(value: bigint): Capital {
  return CAPITAL_TYPE_MAP[Number(value)] ?? "UNKNOWN";
}

export function mapWeightScheme(value: bigint): WeightScheme {
  return WEIGHT_SCHEME_MAP[Number(value)] ?? "LINEAR";
}

export function mapPoolType(value: bigint): PoolType {
  return POOL_TYPE_MAP[Number(value)] ?? "HYPERCERT";
}

export function mapENSNameType(value: bigint): string {
  return ENS_NAME_TYPE_MAP[Number(value)] ?? "Gardener";
}
