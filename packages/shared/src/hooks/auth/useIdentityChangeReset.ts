/**
 * One device, one account at a time.
 *
 * When a different account signs in than the last one on this device, straight
 * after the other, after a sign-out, or after a reload, what the previous
 * account left behind goes:
 *
 * - Home's garden filters, every sheet flag, and the Work Dashboard's return
 *   point (`useUIStore.resetForAccountChange`);
 * - each garden's tab, filter, search, scroll and open sheet
 *   (`useGardenStateStore.clearAll`);
 * - the admin's open sheets and their per-page form state
 *   (`useSheetOrchestratorStore.clearAll`);
 * - the recent send recipients (`clearRecentRecipients`) and a work approval
 *   whose receipt it was still waiting on (`clearPendingWorkApproval`);
 * - every cached read whose query key names the previous account;
 * - the screens themselves: the hook returns a session generation, and
 *   `AuthGate` keys the app under it, so no screen keeps the last account's
 *   open sheet or typed words.
 *
 * What stays, because it belongs to the device or keeps its own rules:
 * language, debug mode, install and shell flags (the offline banner, the admin
 * sidebar), the media policy, the reading cache's shared reads, the admin's
 * last garden (keyed by chain and address), drafts and queued work, and a
 * username change in flight (`useUsernameChangeStore`). That change is keyed by
 * its owner on the default chain, where names live: its release is already on
 * the chain, the next account never reads it, and only the same account coming
 * back can claim the name it chose and hear once that it is ready. The
 * commitment drafts and queued jobs are keyed by their owner; the admin's
 * create-garden and create-assessment drafts and a hypercert mint in flight
 * live in this tab's session storage and keep their own rules, since clearing
 * drafts is outside this reset.
 *
 * Only a ready session decides: a restore that may yet fail names an account
 * before it has signed in. The first account on a device adopts what is there.
 * The last account is remembered across sign-out and reload
 * (`getLastAccount`), which is how the same account coming back keeps its
 * filters.
 *
 * A persisted store that is not keyed by `chainId:address` must be cleared
 * here (packages/shared/AGENTS.md, Stores).
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { Hex } from "viem";
import { queryClient } from "../../config/react-query";
import { logger } from "../../modules/app/logger";
import { clearRecentRecipients } from "../blockchain/useRecentRecipients";
import { clearPendingWorkApproval } from "../work/useWorkApprovalLifecycle";
import { getLastAccount, setLastAccount } from "../../modules/auth/session";
import { useGardenStateStore } from "../../stores/useGardenStateStore";
import { useSheetOrchestratorStore } from "../../stores/useSheetOrchestratorStore";
import { useUIStore } from "../../stores/useUIStore";

/**
 * Mounted by `AuthGate` with the signed-in account, or null, and whether the
 * session has finished restoring. Returns the session generation, which moves
 * on each time a different account replaces the last one.
 */
export function useIdentityChangeReset(primaryAddress: Hex | null, isReady: boolean): number {
  const [generation, setGeneration] = useState(0);
  // The last account this session saw, for when storage cannot say.
  const seen = useRef<string | null>(null);
  // Before paint, so the new account's first frame never shows the old one's screen.
  useLayoutEffect(() => {
    // Signed out, or a restore that may yet fail: the next account may be the same one.
    if (!primaryAddress || !isReady) return;
    const account = primaryAddress.toLowerCase();
    let previous = seen.current;
    try {
      previous = getLastAccount()?.toLowerCase() ?? previous;
    } catch (error) {
      logger.warn("[identity] Could not read the last account on this device", { error });
    }
    seen.current = account;
    try {
      setLastAccount(primaryAddress);
    } catch (error) {
      // The next reload cannot tell the accounts apart, but this switch still can.
      logger.warn("[identity] Could not record the last account on this device", { error });
    }
    if (previous && previous !== account) {
      forgetAccount(previous);
      setGeneration((current) => current + 1);
    }
  }, [primaryAddress, isReady]);
  return generation;
}

function forgetAccount(account: string): void {
  // Each part on its own: a store whose storage refuses the write has already
  // reset in memory, and must not keep the rest from resetting too.
  const parts = [
    () => useUIStore.getState().resetForAccountChange(),
    () => useGardenStateStore.getState().clearAll(),
    () => useSheetOrchestratorStore.getState().clearAll(),
    clearRecentRecipients,
    clearPendingWorkApproval,
    () =>
      queryClient.removeQueries({ predicate: ({ queryKey }) => namesAccount(queryKey, account) }),
  ];
  for (const part of parts) {
    try {
      part();
    } catch (error) {
      logger.warn("[identity] Could not clear part of the last account's state", { error });
    }
  }
}

/** Whether a query key names the account anywhere in it, in any casing. */
function namesAccount(part: unknown, account: string): boolean {
  if (typeof part === "string") return part.toLowerCase().includes(account);
  if (Array.isArray(part)) return part.some((item) => namesAccount(item, account));
  if (part && typeof part === "object") {
    return Object.values(part).some((item) => namesAccount(item, account));
  }
  return false;
}
