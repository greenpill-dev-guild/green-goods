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
   * Optional cleanup run when the operator confirms discard (e.g. reset the
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
  onDiscard,
}: UseDirtyCloseOptions): UseDirtyCloseResult {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const blockerRef = useRef<Blocker | null>(null);

  // Inert when blockRouteChange is false (predicate always returns false).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      blockRouteChange && isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useWindowEvent("beforeunload", (event) => {
    if (!blockRouteChange || !isDirty) return;
    event.preventDefault();
    // Modern browsers ignore custom messages; this triggers the native prompt.
    event.returnValue = "";
  });

  useEffect(() => {
    if (blocker.state === "blocked") {
      blockerRef.current = blocker;
      setConfirmOpen(true);
    }
  }, [blocker]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      // Route mode: let onClose navigate; the blocker raises the confirm.
      if (blockRouteChange) {
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
    [blockRouteChange, isDirty, onClose]
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
