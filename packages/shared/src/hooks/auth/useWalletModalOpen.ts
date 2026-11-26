import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { getAppKit } from "../../config/appkit";
import type { WalletConnectEvent } from "../../modules/app/authWalletConnectAnalytics";
import { useTimeout } from "../utils/useTimeout";

function subscribeWalletModalState(onStoreChange: () => void): () => void {
  const appKit = getAppKit();
  if (!appKit) return () => {};
  return appKit.subscribeState(() => onStoreChange());
}

/** Whether the wallet modal is open right now, for code that acts on events outside a render. */
function isAppKitModalOpen(): boolean {
  return getAppKit()?.getState().open ?? false;
}

export type WalletModalResult = "dismissed" | "wallet-error" | "email" | "email-error";

interface WalletModal {
  openProviders?: (onFinish?: (result: WalletModalResult) => void) => void;
  openWallets: () => void;
  openProfile: () => void;
  close: () => void;
  isOpen: () => boolean;
  subscribe: (listener: () => void) => () => void;
  subscribeConnection?: (listener: (event: WalletConnectEvent) => void) => () => void;
}

// The installed app still uses AppKit. Websites supply their own modal above AuthGate.
export const WalletModalContext = createContext<WalletModal | null>(null);

const appKitModal: WalletModal = {
  openWallets: () => void getAppKit()?.open(),
  openProfile: () => void getAppKit()?.open(),
  close: () => void getAppKit()?.close(),
  isOpen: isAppKitModalOpen,
  subscribe: subscribeWalletModalState,
};

export function useWalletModal() {
  return useContext(WalletModalContext) ?? appKitModal;
}

const closedOnServer = () => false;

export function useWalletModalOpen(): boolean {
  const modal = useWalletModal();
  return useSyncExternalStore(modal.subscribe, modal.isOpen, closedOnServer);
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
 * Wallet pickers render above the parent dialog. Their focus and pointer
 * interaction would otherwise trip the
 * dialog's outside-dismiss and close the surface beneath it. The connecting ref
 * covers the open edge; the modal-open state covers the rest of the lifetime.
 */
export function useWalletConnectDismissGuard(): WalletConnectDismissGuard {
  const walletModalOpen = useWalletModalOpen();
  const connectingRef = useRef(false);
  const previousModalOpenRef = useRef(false);
  const { set: scheduleDismiss } = useTimeout();

  useEffect(() => {
    const justClosed = previousModalOpenRef.current && !walletModalOpen;
    previousModalOpenRef.current = walletModalOpen;
    if (!justClosed) return;
    // A dismissal click still belongs to the wallet picker after it closes.
    // Radix can handle the click later in the same event.
    return scheduleDismiss(() => {
      connectingRef.current = false;
    }, 0);
  }, [walletModalOpen, scheduleDismiss]);

  const markConnecting = useCallback(() => {
    connectingRef.current = true;
  }, []);

  const shouldBlockDismiss = useCallback(
    () => connectingRef.current || walletModalOpen,
    [walletModalOpen]
  );

  return { markConnecting, shouldBlockDismiss };
}
