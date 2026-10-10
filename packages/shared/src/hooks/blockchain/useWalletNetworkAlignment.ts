/**
 * useWalletNetworkAlignment
 *
 * Moves a phone wallet onto the app's network when its connection comes up,
 * with no prompt and nothing on screen.
 *
 * Every wallet act already puts the wallet on the network that act needs
 * (`ensureWagmiWalletChain`): a G$ send asks for Celo, a commitment for
 * Arbitrum. Between acts the wallet's network is not the member's concern, so
 * nothing here tells them about it or asks them to change it.
 *
 * The move exists for one reason. After it, wagmi, AppKit and the wallet's
 * provider agree, so anything that asks wagmi for the wallet without naming a
 * network (a message signature, for one) finds it. Only a WalletConnect session
 * that holds the connected address on the network is moved, because that switch
 * happens on the app's side and leaves who signs unchanged. A wallet that would
 * show a prompt is left alone until an act needs it.
 *
 * @module hooks/blockchain/useWalletNetworkAlignment
 */

import { getAccount, type Config } from "@wagmi/core";
import { useAccount, useConfig } from "wagmi";
import { logger } from "../../modules/app/logger";
import {
  ensureWagmiWalletChain,
  walletNetworkOtherThan,
  walletSwitchesQuietly,
} from "../../modules/transactions/chain-guard";
import { useUser } from "../auth/useUser";
import { useAsyncEffect } from "../utils/useAsyncEffect";
import { useCurrentChain } from "./useChainConfig";

async function alignQuietly(
  config: Config,
  targetChainId: number,
  stillThisWallet: () => boolean
): Promise<void> {
  try {
    if ((await walletNetworkOtherThan(config, targetChainId)) === undefined) return;
    if (!(await walletSwitchesQuietly(config, targetChainId))) return;
    // The guard acts on whichever wallet holds the connection when it switches,
    // with the session as it stands then. It asks this right before: the switch
    // is judged quiet again, and who holds the connection is checked last, with
    // nothing awaited after it. A wallet that took the connection over is left
    // to its own run.
    await ensureWagmiWalletChain(config, targetChainId, "sign-in", async () => {
      const quiet = await walletSwitchesQuietly(config, targetChainId);
      if (!quiet || !stillThisWallet()) throw new Error("The wallet connection changed");
    });
  } catch (error) {
    // A run that another wallet superseded has nothing to report.
    if (!stillThisWallet()) return;
    // The guard has already reported the refusal. The wallet's next act
    // switches it, or says why it cannot.
    logger.warn("Wallet did not move to the app's network when it connected", {
      source: "useWalletNetworkAlignment",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function useWalletNetworkAlignment(): void {
  const { authMode } = useUser();
  const config = useConfig();
  const { address, connector, status } = useAccount();
  const targetChainId = useCurrentChain();
  const connected = authMode === "wallet" && status === "connected";

  // The connection coming up: sign-in, a reload, a dropped wallet answering
  // again, or another wallet or account taking the connection over while wagmi
  // stays connected.
  useAsyncEffect(
    async ({ isMounted }) => {
      if (!connected) return;
      // React cleans this effect up a moment after wagmi's connection changes,
      // so the connection itself is compared as well.
      const stillThisWallet = () => {
        const now = getAccount(config);
        return isMounted() && now.address === address && now.connector?.uid === connector?.uid;
      };
      await alignQuietly(config, targetChainId, stillThisWallet);
    },
    [connected, address, connector?.uid, config, targetChainId]
  );
}
