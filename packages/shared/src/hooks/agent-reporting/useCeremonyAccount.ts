import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useSignMessage } from "wagmi";
import type { ChallengeResponse } from "../../modules/agent-reporting/api-contract";
import type { CeremonyClient } from "../../modules/agent-reporting/ceremony-client";
import { buildReportingProofMessage } from "../../modules/agent-reporting/proof";
import {
  createAccountMessageSigner,
  resolveAccountFactoryArgs,
} from "../../modules/auth/account-message-signer";
import { useAuthActions, useAuthState } from "../../providers/Auth";
import type { Address } from "../../types/domain";
import { getPrimaryAddress } from "../auth/usePrimaryAddress";
import { getFriendlyLoginErrorMessage } from "../client-ui/auth/login-screen-messages";

/**
 * The account half of a browser ceremony: which existing account is connected, how to connect
 * one, and how it proves ownership for this browser's challenge. A link flow may create a
 * passkey account before the explicit proof signature.
 */
export interface CeremonyAccount {
  account: Address | null;
  accountKind: "wallet" | "passkey" | null;
  connecting: boolean;
  lastFailure: string | null;
  createAccount: (name: string) => Promise<boolean>;
  connectWallet: () => void;
  connectPasskey: () => Promise<void>;
  /** Signs the Agent's proof fields for this challenge and submits them. */
  prove: (client: CeremonyClient, challengeId: string) => Promise<ChallengeResponse>;
}

export function useCeremonyAccount(): CeremonyAccount {
  const intl = useIntl();
  const [lastFailure, setLastFailure] = useState<string | null>(null);
  const auth = useAuthState();
  const actions = useAuthActions();
  const { signMessageAsync } = useSignMessage();
  const account = getPrimaryAddress(
    auth.authMode,
    auth.walletAddress,
    auth.smartAccountAddress,
    auth.embeddedAddress
  );
  const smartAccount = auth.smartAccountClient?.account;

  useEffect(() => {
    if (auth.error && !auth.isAuthenticating)
      setLastFailure(getFriendlyLoginErrorMessage(auth.error, intl));
  }, [auth.error, auth.isAuthenticating, intl]);

  const connectPasskey = useCallback(async () => {
    setLastFailure(null);
    try {
      await actions.loginWithPasskey();
    } catch (error) {
      setLastFailure(getFriendlyLoginErrorMessage(error, intl));
    }
  }, [actions, intl]);

  const createAccount = useCallback(
    async (name: string): Promise<boolean> => {
      setLastFailure(null);
      try {
        await actions.createAccount(name);
        return true;
      } catch (error) {
        setLastFailure(getFriendlyLoginErrorMessage(error, intl));
        return false;
      }
    },
    [actions, intl]
  );

  const signer = useMemo(
    () =>
      createAccountMessageSigner({
        authMode: auth.authMode,
        signMessage: signMessageAsync,
        account: smartAccount,
      }),
    [auth.authMode, smartAccount, signMessageAsync]
  );

  const prove = useCallback(
    async (client: CeremonyClient, challengeId: string) => {
      if (!account) throw new Error("Connect your account before continuing.");
      // Fresh fields every time: the Agent rebuilds this exact message to verify it.
      const current = await client.challenge(challengeId);
      const signature = await signer(buildReportingProofMessage(current.proof, account));
      // An undeployed passkey account proves through its factory (ERC-6492).
      const factoryArgs =
        auth.authMode === "passkey" ? await resolveAccountFactoryArgs(smartAccount) : undefined;
      return client.submitProof(challengeId, {
        account,
        signature,
        ...(factoryArgs?.factory && factoryArgs.factoryData
          ? { factory: factoryArgs.factory as `0x${string}`, factoryData: factoryArgs.factoryData }
          : {}),
      });
    },
    [account, auth.authMode, signer, smartAccount]
  );

  return {
    account,
    accountKind: auth.authMode === "passkey" ? "passkey" : auth.authMode === null ? null : "wallet",
    connecting: auth.isAuthenticating,
    lastFailure,
    createAccount,
    connectWallet: () => {
      setLastFailure(null);
      actions.loginWithWallet();
    },
    connectPasskey,
    prove,
  };
}
