/**
 * The Openfort embedded wallet behind email sign-in.
 *
 * This is the only module that loads `@openfort/openfort-js`, and it loads it on first use, so
 * a passkey or wallet session never downloads it. The wallet is a plain key (an EOA) split into
 * shares; Green Goods uses it only to sign for the Kernel smart account it owns, never to send.
 * Recovery is automatic: a new device asks the agent for a single-use Shield session.
 */

import type { Hex, TypedDataDefinition } from "viem";
import { getOpenfortKeys, getOpenfortRecoveryUrl } from "../../config/openfort";
import type { OpenfortRecoverySessionResponse } from "../../public-contracts/openfort-recovery";

/** Why the agent could not mint a recovery session; the copy says what the person can do. */
export class OpenfortRecoveryUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`Account recovery is unavailable: ${reason}`);
    this.name = "OpenfortRecoveryUnavailableError";
  }
}

/** The Openfort operations Green Goods uses. The default wraps the SDK; tests pass their own. */
export interface OpenfortWallet {
  /** Ends any stored Openfort session first: a code is never asked for on someone else's behalf. */
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  /** Create the wallet on first sign-in, or recover it on a new device; returns the owner key. */
  configureWallet(chainId: number): Promise<Hex>;
  /** The configured wallet's address, or null when this device holds no usable signer. */
  currentOwnerAddress(): Promise<Hex | null>;
  /** Local only: whether an Openfort session is stored on this device. */
  hasStoredSession(): Promise<boolean>;
  signMessage(message: Hex | string, raw: boolean): Promise<Hex>;
  signTypedData(typedData: TypedDataDefinition): Promise<Hex>;
  /** Clears the session and flushes the signer, even offline. */
  signOut(): Promise<void>;
}

type OpenfortModule = typeof import("@openfort/openfort-js");
type OpenfortSdk = InstanceType<OpenfortModule["Openfort"]>;

let loaded: Promise<{ sdk: OpenfortSdk; module: OpenfortModule }> | null = null;

function load() {
  loaded ??= import("@openfort/openfort-js").then((module) => {
    const keys = getOpenfortKeys();
    if (!keys) throw new Error("Email sign-in is not configured");
    const sdk = new module.Openfort({
      baseConfiguration: { publishableKey: keys.publishableKey },
      shieldConfiguration: { shieldPublishableKey: keys.shieldPublishableKey },
      // Openfort's own error reporting stays off: our logger and Sentry own that.
      disableTelemetry: true,
    });
    return { sdk, module };
  });
  loaded.catch(() => {
    loaded = null;
  });
  return loaded;
}

async function fetchRecoverySession(accessToken: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(getOpenfortRecoveryUrl(), {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new OpenfortRecoveryUnavailableError("offline");
  }
  const body = (await response.json().catch(() => null)) as OpenfortRecoverySessionResponse | null;
  if (!body || !body.ok) throw new OpenfortRecoveryUnavailableError(body?.errorCode ?? "unknown");
  return body.session;
}

export const defaultOpenfortWallet: OpenfortWallet = {
  async requestCode(email) {
    const { sdk } = await load();
    if (await sdk.getAccessToken()) await sdk.auth.logout();
    await sdk.auth.requestEmailOtp({ email });
  },

  async verifyCode(email, code) {
    const { sdk } = await load();
    await sdk.auth.logInWithEmailOtp({ email, otp: code });
  },

  async configureWallet(chainId) {
    const { sdk, module } = await load();
    const token = await sdk.getAccessToken();
    if (!token) throw new Error("Sign in before setting up the wallet");
    const encryptionSession = await fetchRecoverySession(token);
    const account = await sdk.embeddedWallet.configure({
      chainId,
      chainType: module.ChainTypeEnum.EVM,
      accountType: module.AccountTypeEnum.EOA,
      recoveryParams: { recoveryMethod: module.RecoveryMethod.AUTOMATIC, encryptionSession },
    });
    return account.address as Hex;
  },

  async currentOwnerAddress() {
    const { sdk, module } = await load();
    if ((await sdk.embeddedWallet.getEmbeddedState()) !== module.EmbeddedState.READY) return null;
    return (await sdk.embeddedWallet.get()).address as Hex;
  },

  async hasStoredSession() {
    const { sdk, module } = await load();
    return (await sdk.embeddedWallet.getEmbeddedState()) !== module.EmbeddedState.UNAUTHENTICATED;
  },

  async signMessage(message, raw) {
    const { sdk } = await load();
    const signature = raw
      ? await sdk.embeddedWallet.signMessage(message, { hashMessage: true, arrayifyMessage: true })
      : await sdk.embeddedWallet.signMessage(message);
    return signature as Hex;
  },

  async signTypedData(typedData) {
    const { sdk } = await load();
    const { EIP712Domain: _domainType, ...types } = (typedData.types ?? {}) as Record<
      string,
      unknown
    >;
    const signature = await sdk.embeddedWallet.signTypedData(
      (typedData.domain ?? {}) as Parameters<OpenfortSdk["embeddedWallet"]["signTypedData"]>[0],
      types as Parameters<OpenfortSdk["embeddedWallet"]["signTypedData"]>[1],
      typedData.message as Parameters<OpenfortSdk["embeddedWallet"]["signTypedData"]>[2]
    );
    return signature as Hex;
  },

  async signOut() {
    const { sdk } = await load();
    await sdk.auth.logout();
  },
};
