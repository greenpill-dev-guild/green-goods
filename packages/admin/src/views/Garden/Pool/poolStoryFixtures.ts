/**
 * Storybook fixtures for the pool console surfaces. Plain records shaped
 * exactly as the shared read models and controllers return them, on the
 * frozen Storybook clock, so every story renders the real component over
 * data the hooks could have produced. Not a component: no story of its own.
 *
 * The records live in sibling modules grouped by what they build; this module
 * is the entry point every story imports, and it composes the route seeds.
 */

import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { QueryKey } from "@tanstack/react-query";
import { STORY_GARDEN, STORY_NOW } from "./poolStoryActors";
import { STORY_CLAIMS, STORY_COMMITMENTS } from "./poolStoryCommitments";
import { STORY_CYCLES, storyPool } from "./poolStoryPools";

export * from "./poolStoryActors";
export * from "./poolStoryCommitments";
export * from "./poolStoryControllers";
export * from "./poolStoryPools";
export * from "./poolStorySettlement";

/**
 * The reserve's G$ price on 2026-09-30, read at Storybook's frozen now: $1 is
 * about 7,773 G$, so $5.00 is about 38,866 G$.
 */
export const STORY_PRICE_STATE = {
  status: "ready",
  price: 128_647_930_734_508n,
  readAt: Number(STORY_NOW) * 1000,
} as const satisfies GoodDollarPriceState;

/** That read, under the key `useGoodDollarPrice` reads. */
export const STORY_PRICE_SEED: readonly [QueryKey, unknown] = [
  queryKeys.tokens.goodDollarPrice(),
  { price: STORY_PRICE_STATE.price, readAt: STORY_PRICE_STATE.readAt },
];

/**
 * Seeds for the route stories: the G$ price, the garden's pool, its cycles,
 * commitments and claims under the registry keys the controllers read, so the
 * real route renders over fixtures without an indexer or a price read.
 */
export const POOL_STORY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  STORY_PRICE_SEED,
  [queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_GARDEN), [storyPool()]],
  [queryKeys.commitmentPooling.cycles(DEFAULT_CHAIN_ID, 7n, {}), STORY_CYCLES],
  [
    queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
      chainId: DEFAULT_CHAIN_ID,
      poolId: 7n,
    }),
    STORY_COMMITMENTS,
  ],
  [queryKeys.commitmentPooling.poolClaims(DEFAULT_CHAIN_ID, 7n, "PENDING"), STORY_CLAIMS],
];
