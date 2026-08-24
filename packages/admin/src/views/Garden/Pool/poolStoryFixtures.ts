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
import type { QueryKey } from "@tanstack/react-query";
import { STORY_GARDEN } from "./poolStoryActors";
import { STORY_CLAIMS, STORY_COMMITMENTS } from "./poolStoryCommitments";
import { STORY_CYCLES, storyPool } from "./poolStoryPools";

export * from "./poolStoryActors";
export * from "./poolStoryCommitments";
export * from "./poolStoryControllers";
export * from "./poolStoryPools";

/**
 * Seeds for the route stories: the garden's pool, its cycles, commitments
 * and claims under the registry keys the controllers read, so the real
 * route renders over fixtures without an indexer.
 */
export const POOL_STORY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
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
