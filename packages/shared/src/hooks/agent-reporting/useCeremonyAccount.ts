import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useSignMessage } from "wagmi";
import { isPasskeyServerEnabled } from "../../config/passkeyServer";
import type { ChallengeResponse } from "../../modules/agent-reporting/api-contract";
import type { CeremonyClient } from "../../modules/agent-reporting/ceremony-client";
import { buildReportingProofMessage } from "../../modules/agent-reporting/proof";
import { trackAuthError } from "../../modules/app/error-categories";
import {
  createAccountMessageSigner,
  resolveAccountFactoryArgs,
} from "../../modules/auth/account-message-signer";
import { useAuthActions, useAuthState } from "../../providers/Auth";
import type { Address } from "../../types/domain";
import { getPrimaryAddress } from "../auth/usePrimaryAddress";
import { getFriendlyLoginErrorMessage } from "../client-ui/auth/login-screen-messages";
import { type AccountFailure, accountFailureReason } from "./account-failure";

/**
 * The account half of a browser ceremony: which existing account is connected, how to connect
 * one or let it go for another, and how it proves ownership for this browser's challenge. A link
 * flow may create a passkey account before the explicit proof signature.
 *
 * The connected account is the website's own sign-in, shared by every page in this browser. A
 * chat link opened here therefore starts on whichever account was last used, which need not be
 * the one the person means to link.
 */
export interface CeremonyAccount {
  account: Address | null;
  accountKind: "wallet" | "passkey" | null;
  connecting: boolean;
  /** Why the last attempt to connect or create an account failed, until the next attempt. */
  failure: AccountFailure | null;
  /** This browser remembers a passkey account, so its passkey can be asked for without a name. */
  savedPasskey: boolean;
  /** A passkey account kept on another device can be found here by the name it was created with. */
  canFindAccount: boolean;
  /** Only ever at the person's explicit request: no failed sign-in leads here by itself. */
  createAccount: (name: string) => Promise<boolean>;
  connectWallet: () => void;
  /** With a name, that account's passkey; without one, the passkey this browser remembers. */
  connectPasskey: (name?: string) => Promise<void>;
  /** Lets go of the connected account, so the page asks which one to use. False if it could not. */
  changeAccount: () => Promise<boolean>;
  /** Signs the Agent's proof fields for this challenge and submits them. */
  prove: (client: CeremonyClient, challengeId: string) => Promise<ChallengeResponse>;
}

export function useCeremonyAccount(): CeremonyAccount {
  const intl = useIntl();
  const [failure, setFailure] = useState<AccountFailure | null>(null);
  // Whether the attempt in flight creates an account: a prompt that closes then made none.
  const creating = useRef(false);
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

  const describe = useCallback(
    (error: unknown): AccountFailure => ({
      reason: accountFailureReason(error, { creating: creating.current }),
      spoken: getFriendlyLoginErrorMessage(error, intl, { creating: creating.current }),
    }),
    [intl]
  );

  // What the person reads may be only "Something went wrong", so the error itself is recorded.
  const failed = useCallback(
    (error: unknown, userAction: string) => {
      trackAuthError(error, { source: "useCeremonyAccount", userAction, recoverable: true });
      setFailure(describe(error));
    },
    [describe]
  );

  // One record per failed attempt. While its words are still on the page they follow the
  // reader's language; once another attempt has cleared them, the same error never brings them
  // back, as a wallet chooser closed over an earlier passkey failure would.
  const recorded = useRef<unknown>(null);
  useEffect(() => {
    const error = auth.error;
    if (!error || auth.isAuthenticating) return;
    if (recorded.current === error) {
      setFailure((current) => (current ? describe(error) : current));
      return;
    }
    recorded.current = error;
    failed(error, creating.current ? "create_account" : "sign_in");
  }, [auth.error, auth.isAuthenticating, describe, failed]);

  const connectPasskey = useCallback(
    async (name?: string) => {
      creating.current = false;
      setFailure(null);
      try {
        await actions.loginWithPasskey(name);
      } catch (error) {
        failed(error, "connect_passkey");
      }
    },
    [actions, failed]
  );

  const changeAccount = useCallback(async () => {
    creating.current = false;
    setFailure(null);
    try {
      await actions.signOut();
      return true;
    } catch (error) {
      failed(error, "change_account");
      return false;
    }
  }, [actions, failed]);

  const createAccount = useCallback(
    async (name: string): Promise<boolean> => {
      creating.current = true;
      setFailure(null);
      try {
        await actions.createAccount(name);
        return true;
      } catch (error) {
        failed(error, "create_account");
        return false;
      }
    },
    [actions, failed]
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
    failure,
    savedPasskey: auth.hasStoredCredential,
    canFindAccount: isPasskeyServerEnabled(),
    createAccount,
    connectWallet: () => {
      creating.current = false;
      setFailure(null);
      actions.loginWithWallet();
    },
    connectPasskey,
    changeAccount,
    prove,
  };
}
