import { Capital, PoolType, WeightScheme } from "../../generated";
import type { Domain_t } from "../../generated/src/db/Enums.gen";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maps numeric capital type values from the smart contract to Capital enum values.
 * These values correspond to the Capital enum in the ActionRegistry contract.
 */
export const CAPITAL_TYPE_MAP: Record<number, Capital> = {
  0: "SOCIAL",
  1: "MATERIAL",
  2: "FINANCIAL",
  3: "LIVING",
  4: "INTELLECTUAL",
  5: "EXPERIENTIAL",
  6: "SPIRITUAL",
  7: "CULTURAL",
} as const;

/**
 * Maps numeric domain type values from the smart contract to Domain enum string values.
 * These values correspond to the Domain enum in the ActionRegistry contract.
 */
export const DOMAIN_TYPE_MAP: Record<number, Domain_t> = {
  0: "SOLAR",
  1: "AGRO",
  2: "EDU",
  3: "WASTE",
} as const;

/**
 * Maps numeric weight scheme values from the GardensModule contract to WeightScheme enum values.
 * These values correspond to the WeightScheme enum in IGardensModule.
 */
export const WEIGHT_SCHEME_MAP: Record<number, WeightScheme> = {
  0: "LINEAR",
  1: "EXPONENTIAL",
  2: "POWER",
} as const;

/**
 * Maps numeric pool type values from the GardensModule contract to PoolType enum values.
 */
export const POOL_TYPE_MAP: Record<number, PoolType> = {
  0: "HYPERCERT",
  1: "ACTION",
} as const;

/**
 * Garden role enum mapping (mirrors IHatsModule.GardenRole)
 */
export const GARDEN_ROLE = {
  Gardener: 0,
  Evaluator: 1,
  Operator: 2,
  Owner: 3,
  Funder: 4,
  Community: 5,
} as const;

// Zero address constant used for guards and defaults.
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Maps NameType enum from the GreenGoodsENS contract.
 * 0 = Gardener, 1 = Garden
 */
export const ENS_NAME_TYPE_MAP: Record<number, string> = {
  0: "Gardener",
  1: "Garden",
} as const;

export const DEFAULT_IPFS_GATEWAY = "https://storacha.link/ipfs/";
