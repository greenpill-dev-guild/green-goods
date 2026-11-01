import { useCallback, useEffect, useRef, useState } from "react";
import { type Blocker, useBlocker } from "react-router-dom";
import { useWindowEvent } from "../utils/useEventListener";

export interface UseDirtyCloseOptions {
  /** Whether the form holds unsaved input worth confirming before close. */
  isDirty: boolean;
  /** Perform the real close — navigate away or flip a state flag. */
  onClose: () => void;
  /**
   * When true, also intercept React Router navigations (back button, nav
   * links, and a navigating `onClose`) via `useBlocker` + `beforeunload`. Use
   * for route-mounted flow dialogs that close by navigating: the blocker
   * becomes the sole confirm trigger, so there is no double prompt. Defaults to
   * false — state-driven dialogs intercept only their own close.
   */
  blockRouteChange?: boolean;
  /**
   * When true, cancel route-driven closes outright instead of showing the
   * discard confirm. Use for pending writes where leaving cannot be made safe
   * by discarding local draft state.
   */
  preventRouteChange?: boolean;
  /**
   * Optional cleanup run when the steward confirms discard (e.g. reset the
   * wizard store), before the close/navigation proceeds.
   */
  onDiscard?: () => void;
}

export interface UseDirtyCloseResult {
  /** Wire to `AdminDialog.onOpenChange`. */
  onOpenChange: (open: boolean) => void;
  /** Whether the discard-confirm should render (feed `DiscardChangesDialog`). */
  confirmOpen: boolean;
  /** "Keep editing" — dismiss the confirm and stay in the form. */
  cancelClose: () => void;
  /** "Discard" — proceed with the real close. */
  confirmClose: () => void;
}

/**
 * The guards holding unsaved input or a pending write, latest last. The router
 * consults only its most recently registered blocker, and every mounted
 * useDirtyClose registers one, armed or not. So each hook's predicate asks about
 * all of them, and whichever hook the router asked hands the block to the guard
 * that armed last.
 */
const armedGuards = new Set<(blocker: Blocker) => void>();

/**
 * Confirm-before-discard for admin flow dialogs. Gates an `AdminDialog` close
 * on a dirty signal and surfaces a confirm (wire the result to
 * `DiscardChangesDialog`). Generalizes the bespoke leave-confirm in
 * `useWizardData`. Two close vectors, selected by `blockRouteChange`:
 *
 * - **state mode** (default): intercept the dialog's own close (X / scrim /
 *   Escape) when dirty; `confirmClose` runs `onClose` directly.
 * - **route mode** (`blockRouteChange: true`): the dialog closes by navigating,
 *   so `onOpenChange` lets `onClose` navigate and `useBlocker` raises the
 *   confirm — covering the X-that-navigates, the back button, and nav links
 *   through one path with no double prompt.
 */
export function useDirtyClose({
  isDirty,
  onClose,
  blockRouteChange = false,
  preventRouteChange = false,
  onDiscard,
}: UseDirtyCloseOptions): UseDirtyCloseResult {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const blockerRef = useRef<Blocker | null>(null);
  // Never armed when blockRouteChange is false, though its blocker still registers.
  const armed = blockRouteChange && (isDirty || preventRouteChange);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      armedGuards.size > 0 &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
  );

  useWindowEvent("beforeunload", (event) => {
    if (!blockRouteChange || (!isDirty && !preventRouteChange)) return;
    event.preventDefault();
    // Modern browsers ignore custom messages; this triggers the native prompt.
    event.returnValue = "";
  });

  const takeBlock = useCallback(
    (activeBlocker: Blocker) => {
      if (preventRouteChange) {
        activeBlocker.reset?.();
        blockerRef.current = null;
        setConfirmOpen(false);
        return;
      }
      blockerRef.current = activeBlocker;
      setConfirmOpen(true);
    },
    [preventRouteChange]
  );

  useEffect(() => {
    if (!armed) return;
    armedGuards.add(takeBlock);
    return () => {
      armedGuards.delete(takeBlock);
    };
  }, [armed, takeBlock]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const latestGuard = [...armedGuards].at(-1);
    if (latestGuard) latestGuard(blocker);
    else blocker.reset?.();
  }, [blocker, takeBlock]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      // Route mode: let onClose navigate; the blocker raises the confirm.
      if (blockRouteChange) {
        if (preventRouteChange) return;
        onClose();
        return;
      }
      // State mode: intercept here when dirty.
      if (isDirty) {
        setConfirmOpen(true);
        return;
      }
      onClose();
    },
    [blockRouteChange, isDirty, onClose, preventRouteChange]
  );

  const cancelClose = useCallback(() => {
    blockerRef.current?.reset?.();
    blockerRef.current = null;
    setConfirmOpen(false);
  }, []);

  const confirmClose = useCallback(() => {
    setConfirmOpen(false);
    onDiscard?.();
    const activeBlocker = blockerRef.current;
    blockerRef.current = null;
    if (activeBlocker) {
      activeBlocker.proceed?.();
      return;
    }
    onClose();
  }, [onClose, onDiscard]);

  return { onOpenChange, confirmOpen, cancelClose, confirmClose };
}
