/**
 * What a settings save writes. Each setting is written only when it changed,
 * the agreement first (`settingsSteps`), and the agreement is pinned before
 * anything is planned, so a pin failure throws while nothing has been sent.
 */
import { pinPoolCharter } from "@green-goods/shared/modules/commitment-pooling/pool-charter";
import {
  type PoolSetupAction,
  type PoolSetupStep,
  settingsSteps,
} from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import type { Address } from "@green-goods/shared/types/domain";

export interface PoolSettingsValues {
  /** The agreement's words, trimmed. */
  purpose: string;
  /** How many open commitments one person may hold. */
  cap: bigint;
}

export interface PoolSettingsChanges {
  agreement: boolean;
  limit: boolean;
}

/** Which settings the steward changed against what the pool holds. */
export function changedSettings(
  next: PoolSettingsValues,
  current: PoolSettingsValues
): PoolSettingsChanges {
  return { agreement: next.purpose !== current.purpose, limit: next.cap !== current.cap };
}

/**
 * The writes a save will send, known before the agreement is pinned, so the
 * dialog can say up front how many times the wallet will ask. It asks the same
 * planner the save uses; the placeholder values are never sent.
 */
export function settingsActions(changes: PoolSettingsChanges): PoolSetupAction[] {
  return settingsSteps({
    poolId: 0n,
    charterCID: changes.agreement ? "" : null,
    cap: changes.limit ? 0n : null,
  }).map((step) => step.action);
}

/** Pins a changed agreement, then plans the writes that store what changed. */
export async function planSettingsSteps(input: {
  poolId: bigint;
  garden: Address;
  next: PoolSettingsValues;
  current: PoolSettingsValues;
}): Promise<PoolSetupStep[]> {
  const changes = changedSettings(input.next, input.current);
  const charterCID = changes.agreement
    ? await pinPoolCharter({ purpose: input.next.purpose, gardenAddress: input.garden })
    : null;
  return settingsSteps({
    poolId: input.poolId,
    charterCID,
    cap: changes.limit ? input.next.cap : null,
  });
}
