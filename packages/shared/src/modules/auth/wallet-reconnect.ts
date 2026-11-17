/**
 * Asking the person to reconnect a wallet that has not answered.
 *
 * The App opens on a remembered wallet account before its wallet answers
 * (PRD-1499), so an act that needs the wallet can start while the session can
 * only read. The send path refuses that act before anything starts and asks
 * here; the prompt each app mounts (`useWalletReconnectPrompt`) says so in the
 * person's language and offers Reconnect. The send path runs outside React and
 * has no catalog of its own, which is why the ask travels through this module.
 *
 * @module modules/auth/wallet-reconnect
 */

import { WalletReconnectRequiredError } from "../../utils/errors/unsent-failures";
import { trackAuthWalletRestore } from "../app/authWalletRestoreAnalytics";

type ReconnectAsk = () => void;

const asks = new Set<ReconnectAsk>();

/** Mount a prompt that asks the person to reconnect; returns its removal. */
export function onWalletReconnectAsk(ask: ReconnectAsk): () => void {
  asks.add(ask);
  return () => {
    asks.delete(ask);
  };
}

/**
 * Refuse an act that needs the wallet before it starts: record it, ask every
 * mounted prompt to offer Reconnect, then throw. The error says whether one
 * asked, so the act's own error handling can stay quiet instead of saying it twice.
 */
export function refuseWithoutWallet(): never {
  trackAuthWalletRestore({ authMode: "wallet", outcome: "act_refused" });
  for (const ask of asks) ask();
  throw new WalletReconnectRequiredError(asks.size > 0);
}
