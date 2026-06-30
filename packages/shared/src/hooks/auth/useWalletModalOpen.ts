import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getAppKit } from "../../config/appkit";

function subscribeWalletModalState(onStoreChange: () => void): () => void {
  const appKit = getAppKit();
  if (!appKit) return () => {};
  return appKit.subscribeState(() => onStoreChange());
}

function getWalletModalOpenSnapshot(): boolean {
  return getAppKit()?.getState().open ?? false;
}

function getWalletModalOpenServerSnapshot(): boolean {
  return false;
}

/**
 * Reflects whether the Reown AppKit wallet modal is currently open.
 *
 * Backed by AppKit's state subscription. Returns `false` in SSR/tests where
 * AppKit is not initialized (`getAppKit()` is null).
 */
export function useWalletModalOpen(): boolean {
  return useSyncExternalStore(
    subscribeWalletModalState,
    getWalletModalOpenSnapshot,
    getWalletModalOpenServerSnapshot
  );
}

export interface WalletConnectDismissGuard {
  /**
   * Call synchronously in the connect click handler, BEFORE opening the wallet
   * modal. Covers the open-autofocus edge that fires before the modal-open
   * state propagates through React.
   */
  markConnecting: () => void;
  /**
   * Returns whether an outside-dismiss (pointer/focus/escape) should be blocked
   * right now. Reads a live ref, so it is correct even between the connect click
   * and the modal-open state landing.
   */
  shouldBlockDismiss: () => boolean;
}

/**
 * Keeps a Radix Dialog (or similar dismissable surface) open while the wallet
 * modal is opening or open.
 *
 * The AppKit wallet modal renders in a separate portal as an in-DOM web
 * component; its open-autofocus / pointer interaction would otherwise trip the
 * dialog's outside-dismiss and close the surface beneath it. The connecting ref
 * covers the open edge; the modal-open state covers the rest of the lifetime.
 */
export function useWalletConnectDismissGuard(): WalletConnectDismissGuard {
  const walletModalOpen = useWalletModalOpen();
  const connectingRef = useRef(false);
  const previousModalOpenRef = useRef(false);

  useEffect(() => {
    // Clear the connecting intent only on the open -> closed transition
    // (connected or cancelled). Clearing whenever it is merely false would
    // race with the click->open window and defeat the guard.
    if (previousModalOpenRef.current && !walletModalOpen) {
      connectingRef.current = false;
    }
    previousModalOpenRef.current = walletModalOpen;
  }, [walletModalOpen]);

  const markConnecting = useCallback(() => {
    connectingRef.current = true;
  }, []);

  const shouldBlockDismiss = useCallback(
    () => connectingRef.current || walletModalOpen,
    [walletModalOpen]
  );

  return { markConnecting, shouldBlockDismiss };
}
