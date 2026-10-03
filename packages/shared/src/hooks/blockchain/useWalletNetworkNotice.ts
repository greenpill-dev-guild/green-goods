/**
 * useWalletNetworkNotice
 *
 * Keeps a wallet member's wallet on the app's network without surprising them.
 *
 * Every wallet write already checks the wallet's network and switches it
 * (`ensureWagmiWalletChain`). This hook covers the time before the first write:
 *
 * - A phone wallet whose WalletConnect session holds the app's network is moved
 *   there when the connection comes up. No prompt appears, and wagmi, AppKit and
 *   the wallet's provider then agree, so writes that take a wallet client from
 *   wagmi work as well.
 * - Any other wallet, a browser wallet above all, gets a notice with a Switch
 *   button rather than a wallet popup nobody asked for (PRD-1067).
 *
 * Nothing is switched when the member comes back to the app. That is the moment
 * a send they approved in their wallet is still in flight, and moving the
 * network under it could send its next step to the wrong one. A network change
 * while they use the app (a G$ send moving the wallet to Celo) can clear a
 * standing notice but never raises one.
 *
 * @module hooks/blockchain/useWalletNetworkNotice
 */

import type { Config } from "@wagmi/core";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useAccount, useConfig } from "wagmi";
import { getChainName, isChainSupported } from "../../config/chains";
import { logger } from "../../modules/app/logger";
import {
  ensureWagmiWalletChain,
  onWalletNetworkSwitched,
  walletNetworkOtherThan,
  walletSwitchesQuietly,
} from "../../modules/transactions/chain-guard";
import { useUser } from "../auth/useUser";
import { useAsyncEffect } from "../utils/useAsyncEffect";
import { useDocumentEvent } from "../utils/useEventListener";
import { useCurrentChain } from "./useChainConfig";

export interface WalletNetworkNoticeState {
  /** "Wallet on Celo", or "Wallet still on Celo" after a switch that did not take. */
  message: string;
  /** "Switch to Arbitrum One". */
  switchLabel: string;
  isSwitching: boolean;
  /** Ask the wallet to move to the app's network: one prompt on a browser wallet. */
  switchNetwork: () => Promise<void>;
}

/**
 * The network to name in the notice, or null for none. With `onConnect`, a
 * wallet that switches without a prompt is moved now and needs no notice.
 */
async function noticeNetwork(
  config: Config,
  targetChainId: number,
  onConnect: boolean
): Promise<number | null> {
  const other = await walletNetworkOtherThan(config, targetChainId);
  if (other === undefined) return null;
  if (!(await walletSwitchesQuietly(config, targetChainId))) return other;
  // Back in the app, its next write switches without a prompt.
  if (!onConnect) return null;
  try {
    await ensureWagmiWalletChain(config, targetChainId, "sign-in");
    return null;
  } catch (error) {
    // The guard has already reported the refusal; the notice offers the switch.
    logger.warn("Wallet did not move to the app's network when it connected", {
      source: "useWalletNetworkNotice",
      error: error instanceof Error ? error.message : String(error),
    });
    return other;
  }
}

/** The notice to show, or null when the wallet is where the app needs it. */
export function useWalletNetworkNotice(): WalletNetworkNoticeState | null {
  const { formatMessage } = useIntl();
  const { authMode } = useUser();
  const config = useConfig();
  const { status, chainId: storedChainId } = useAccount();
  const targetChainId = useCurrentChain();
  // The network the notice names, and whether a switch away from it was refused.
  // One state, so "still on" cannot outlive the notice it was said about.
  const [standing, setStanding] = useState<{ chainId: number; refused: boolean } | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [returns, setReturns] = useState(0);
  const [guardSwitches, setGuardSwitches] = useState(0);
  const watching = authMode === "wallet" && status === "connected";
  const walletChainId = standing?.chainId ?? null;
  const show = useCallback((chainId: number | null) => {
    setStanding((current) =>
      chainId === null ? null : current?.chainId === chainId ? current : { chainId, refused: false }
    );
  }, []);

  // The connection coming up: sign-in, a reload, or a dropped wallet answering again.
  useAsyncEffect(
    async ({ isMounted }) => {
      if (!watching) {
        show(null);
        return;
      }
      const network = await noticeNetwork(config, targetChainId, true);
      if (isMounted()) show(network);
    },
    [watching, config, targetChainId, show]
  );

  // Coming back to the app: the notice may appear, but nothing is switched.
  useAsyncEffect(
    async ({ isMounted }) => {
      if (!watching || returns === 0) return;
      const network = await noticeNetwork(config, targetChainId, false);
      if (isMounted()) show(network);
    },
    [returns, watching, config, targetChainId, show]
  );

  // A network change while the notice stands, by the wallet or by an act's
  // guard, can only update or clear it.
  useAsyncEffect(
    async ({ isMounted }) => {
      if (!watching || walletChainId === null) return;
      const other = await walletNetworkOtherThan(config, targetChainId);
      if (isMounted()) show(other ?? null);
    },
    [storedChainId, guardSwitches, walletChainId, watching, config, targetChainId, show]
  );

  useDocumentEvent("visibilitychange", () => {
    if (watching && document.visibilityState === "visible") setReturns((count) => count + 1);
  });
  useEffect(() => onWalletNetworkSwitched(() => setGuardSwitches((count) => count + 1)), []);

  const switchNetwork = useCallback(async () => {
    setIsSwitching(true);
    setStanding((current) => current && { ...current, refused: false });
    try {
      await ensureWagmiWalletChain(config, targetChainId, "notice");
      setStanding(null);
    } catch (error) {
      // The guard has already reported the refusal; the notice stays and says so.
      logger.warn("Wallet did not switch network from the notice", {
        source: "useWalletNetworkNotice",
        error: error instanceof Error ? error.message : String(error),
      });
      setStanding((current) => current && { ...current, refused: true });
    } finally {
      setIsSwitching(false);
    }
  }, [config, targetChainId]);

  if (standing === null) return null;
  const network = isChainSupported(standing.chainId)
    ? getChainName(standing.chainId)
    : formatMessage({ id: "app.walletNetwork.otherNetwork", defaultMessage: "another network" });
  return {
    message: formatMessage(
      standing.refused
        ? { id: "app.walletNetwork.stillOn", defaultMessage: "Wallet still on {network}" }
        : { id: "app.walletNetwork.notice", defaultMessage: "Wallet on {network}" },
      { network }
    ),
    switchLabel: formatMessage(
      { id: "app.walletNetwork.switch", defaultMessage: "Switch to {network}" },
      { network: getChainName(targetChainId) }
    ),
    isSwitching,
    switchNetwork,
  };
}
