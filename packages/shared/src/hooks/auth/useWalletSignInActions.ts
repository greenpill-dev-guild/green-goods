import { getConnection } from "@wagmi/core";
import { useCallback, useContext, type RefObject } from "react";
import { isAddressEqual, type Hex } from "viem";
import type { Config } from "wagmi";
import { getAppKit } from "../../config/appkit";
import { WalletModalContext } from "./useWalletModalOpen";
import { logger } from "../../modules/app/logger";
import {
  setAuthMode,
  setEmbeddedAddress,
  setStoredWalletAddress,
} from "../../modules/auth/session";
import type { AuthActor } from "../../workflows/authActor";
import type { Address } from "../../types/domain";

// Pinned to @reown/appkit ^1.8.14 (see packages/{client,admin,shared}/
// package.json). The auth connector exposes its ID as "ID_AUTH" via
// ConstantsUtil.CONNECTOR_ID.AUTH; older AppKit builds used "w3mAuth"
// and "AUTH". Use exact equality on a known set instead of substring
// matching to avoid false positives if a wallet's name happens to contain
// "embedded".
const APPKIT_EMBEDDED_CONNECTOR_IDS = ["ID_AUTH", "w3mAuth", "AUTH"] as const;
export function isAppKitEmbeddedConnector(connector?: { id?: string } | null): boolean {
  return Boolean(
    connector?.id && (APPKIT_EMBEDDED_CONNECTOR_IDS as readonly string[]).includes(connector.id)
  );
}

interface WalletSignInOptions {
  actor: AuthActor | null;
  wagmiConfig: Config;
  walletAnswered: boolean;
  wagmiWalletAddress?: Address;
  connector?: { id: string };
  walletRestoreAttemptedRef: RefObject<boolean>;
  manualWalletLoginPendingRef: RefObject<boolean>;
  syncSignOut: () => boolean;
  afterWalletRelease: (next: () => void) => boolean;
  isConnectionQuarantined: () => boolean;
}

/** Start a wallet picker or adopt an external connection completed by another sign-in UI. */
export function useWalletSignInActions({
  actor,
  wagmiConfig,
  walletAnswered,
  wagmiWalletAddress,
  connector,
  walletRestoreAttemptedRef,
  manualWalletLoginPendingRef,
  syncSignOut,
  afterWalletRelease,
  isConnectionQuarantined,
}: WalletSignInOptions) {
  const walletModal = useContext(WalletModalContext);
  const loginWithConnectedWallet = useCallback(
    (expectedAddress: Hex) => {
      if (!actor || syncSignOut() || isConnectionQuarantined()) return false;
      const { address, connector, isConnected } = getConnection(wagmiConfig);
      const state = actor.getSnapshot();
      if (
        !isConnected ||
        !address ||
        !isAddressEqual(address, expectedAddress) ||
        !wagmiConfig.connectors.some((candidate) => candidate.uid === connector?.uid) ||
        isAppKitEmbeddedConnector(connector)
      )
        return false;

      const reconnecting =
        state.matches({ restoring: "wallet" }) || state.matches({ authenticated: "wallet" });
      if (reconnecting) {
        if (
          !state.context.walletAddress ||
          !isAddressEqual(expectedAddress, state.context.walletAddress)
        )
          return false;
      } else if (!(state.matches("unauthenticated") || state.matches("error"))) {
        return false;
      }

      setStoredWalletAddress(expectedAddress);
      setAuthMode("wallet");
      manualWalletLoginPendingRef.current = false;
      walletRestoreAttemptedRef.current = true;
      actor.send({
        type: "EXTERNAL_WALLET_CONNECTED",
        address: expectedAddress,
        connectionType: "wallet",
      });
      if (!reconnecting) actor.send({ type: "LOGIN_WALLET" });
      return true;
    },
    [
      actor,
      syncSignOut,
      isConnectionQuarantined,
      wagmiConfig,
      manualWalletLoginPendingRef,
      walletRestoreAttemptedRef,
    ]
  );

  const loginWithWallet = useCallback(() => {
    if (!actor) return;
    syncSignOut();
    walletRestoreAttemptedRef.current = false;
    if (walletModal) {
      const open = () => {
        if (!syncSignOut()) walletModal.openWallets();
      };
      if (!afterWalletRelease(open)) open();
      return;
    }
    const askForWallet = () => {
      if (syncSignOut()) return;
      setAuthMode("wallet");
      manualWalletLoginPendingRef.current = true;
      getAppKit()?.open();
    };
    if (afterWalletRelease(askForWallet)) return;

    // Save wallet intent FIRST — this signals to the WALLET EVENT SYNC effect
    // that any subsequent wallet connection should trigger auto-login.
    // Without this, wallet auto-reconnect after passkey sign-out would
    // incorrectly log the user in with wallet (the guard checks this value).
    setAuthMode("wallet");
    manualWalletLoginPendingRef.current = true;

    if (walletAnswered && wagmiWalletAddress) {
      if (isAppKitEmbeddedConnector(connector)) {
        manualWalletLoginPendingRef.current = false;
        logger.warn(
          "[AuthProvider] Connected AppKit account is embedded, opening wallet selector",
          {
            connectorId: connector?.id,
          }
        );
        getAppKit()?.open();
        return;
      }

      const walletAddress = wagmiWalletAddress as Hex;
      const currentState = actor.getSnapshot();
      if (
        !currentState.context.externalWalletConnected ||
        currentState.context.externalWalletAddress !== walletAddress
      ) {
        actor.send({ type: "EXTERNAL_WALLET_CONNECTED", address: walletAddress });
      }

      // Wallet already connected, proceed with login immediately
      manualWalletLoginPendingRef.current = false;
      actor.send({ type: "LOGIN_WALLET" });
    } else {
      // Open modal - when wallet connects, WALLET EVENT SYNC will
      // detect the connection + stored "wallet" intent and send LOGIN_WALLET
      getAppKit()?.open();
    }
  }, [
    actor,
    walletModal,
    walletAnswered,
    wagmiWalletAddress,
    connector,
    afterWalletRelease,
    syncSignOut,
    manualWalletLoginPendingRef,
    walletRestoreAttemptedRef,
  ]);

  const loginWithEmbedded = useCallback(() => {
    if (!actor || walletModal) return;
    syncSignOut();
    walletRestoreAttemptedRef.current = false;

    if (
      afterWalletRelease(() => {
        if (!syncSignOut()) {
          setAuthMode("embedded");
          getAppKit()?.open();
        }
      })
    )
      return;
    setAuthMode("embedded");
    if (walletAnswered && wagmiWalletAddress && isAppKitEmbeddedConnector(connector)) {
      const address = wagmiWalletAddress as Hex;
      actor.send({ type: "EXTERNAL_WALLET_CONNECTED", address, connectionType: "embedded" });
      actor.send({ type: "LOGIN_EMBEDDED", address });
      setEmbeddedAddress(address);
      return;
    }
    getAppKit()?.open();
  }, [
    actor,
    walletModal,
    walletAnswered,
    wagmiWalletAddress,
    connector,
    afterWalletRelease,
    syncSignOut,
    walletRestoreAttemptedRef,
  ]);

  return { loginWithWallet, loginWithConnectedWallet, loginWithEmbedded };
}
