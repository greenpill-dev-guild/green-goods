import { keccak256, stringToHex, type Hex } from "viem";
import type { Address } from "../../../types/domain";
import type { ServiceAccessKey } from "../service-access-types";

/** Fictional module stand-ins, never reviewed deployment addresses. */
export const REHEARSAL_SETTLEMENT = "0x000000000000000000000000000000000000f005" as Address;
export const REHEARSAL_REDEMPTION = "0x000000000000000000000000000000000000f006" as Address;
export function rehearsalHash(value: string): Hex {
  return keccak256(stringToHex(`LOCAL_REHEARSAL_ONLY:${value}`));
}
export function serviceAccessIdentity(key: ServiceAccessKey): string {
  return `${key.sourceChainId}:${key.coreModule.toLowerCase()}:${key.commitmentId}:${key.buyer.toLowerCase()}`;
}
