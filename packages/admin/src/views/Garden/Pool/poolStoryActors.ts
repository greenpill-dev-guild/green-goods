/**
 * The cast and the clock every pool story shares: the garden the stories run
 * in, the steward viewing it, the gardeners inside it, and the frozen
 * Storybook timestamp the read models are evaluated against.
 */

import type { Address } from "@green-goods/shared/types/domain";
import { STORYBOOK_PRIMARY_ADMIN_GARDEN } from "../../../../../shared/.storybook/adminFixtures";
import { STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";

export const STORY_GARDEN = STORYBOOK_PRIMARY_ADMIN_GARDEN.id as Address;
// A literal, not `as Address`: the controllers type the viewer as viem's Hex and
// the admin typecheck resolves the shared Address alias to a plain string.
export const STORY_STEWARD =
  "0x04D60647836bcA09c37B379550038BdaaFD82503" as const satisfies Address;
export const STORY_MARIA = "0x1111111111111111111111111111111111111111" as Address;
export const STORY_JOAO = "0x2222222222222222222222222222222222222222" as Address;
export const STORY_ANA = "0x3333333333333333333333333333333333333333" as Address;
export const STORY_ROOT_GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
export const STORY_NOW = BigInt(STORYBOOK_NOW_SECONDS);
