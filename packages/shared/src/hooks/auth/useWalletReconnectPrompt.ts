/**
 * Tells a wallet account, in the app's own toast, that its wallet has not
 * answered (PRD-1499). The App opens on the account without waiting, so this
 * is where the person learns the wallet is missing:
 *
 * - once, when the restore window ends without an answer and the account
 *   stays signed in;
 * - whenever an act that needs the wallet was refused for it, before anything
 *   started (`refuseWithoutWallet`).
 *
 * Both offer Reconnect, which opens the wallet connection. The toast goes away
 * when the wallet answers. Each app mounts this once, inside its language and
 * auth providers.
 *
 * @module hooks/auth/useWalletReconnectPrompt
 */

import { useCallback, useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { onWalletReconnectAsk } from "../../modules/auth/wallet-reconnect";
import type { WalletRestoreState } from "../../types/auth";
import { useAuthActions, useAuthState } from "./useAuthContext";

const WALLET_RECONNECT_TOAST_ID = "wallet-reconnect";

const COPY = {
  /** The restore window ended without an answer. */
  restoreFailed: {
    title: "app.wallet.reconnect.restoreFailed.title",
    message: "app.wallet.reconnect.restoreFailed.message",
  },
  /** An act that needs the wallet was refused for it. */
  needed: {
    title: "app.wallet.reconnect.needed.title",
    message: "app.wallet.reconnect.needed.message",
  },
} as const;

export function useWalletReconnectPrompt(): void {
  const { formatMessage } = useIntl();
  const { walletRestore = null } = useAuthState();
  const { loginWithWallet } = useAuthActions();

  const ask = useCallback(
    (reason: keyof typeof COPY) =>
      toastService.info({
        id: WALLET_RECONNECT_TOAST_ID,
        title: formatMessage({ id: COPY[reason].title }),
        message: formatMessage({ id: COPY[reason].message }),
        context: "wallet reconnect",
        persistent: true,
        suppressLogging: true,
        action: {
          label: formatMessage({ id: "app.wallet.reconnect.action" }),
          onClick: loginWithWallet,
          testId: "wallet-reconnect-action",
        },
      }),
    [formatMessage, loginWithWallet]
  );

  useEffect(() => onWalletReconnectAsk(() => ask("needed")), [ask]);

  const previous = useRef<WalletRestoreState | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = walletRestore;
    if (walletRestore === "failed" && was !== "failed") {
      ask("restoreFailed");
    } else if (walletRestore === null && was !== null) {
      toastService.dismiss(WALLET_RECONNECT_TOAST_ID);
    }
  }, [walletRestore, ask]);

  // The ask belongs to this prompt's session: it leaves with it.
  useEffect(() => () => toastService.dismiss(WALLET_RECONNECT_TOAST_ID), []);
}
