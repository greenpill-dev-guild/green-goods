/**
 * The Openfort embedded wallet behind email sign-in.
 *
 * The shared auth flow loads the SDK on first use. The wallet is a plain key (an EOA) split into
 * shares; Green Goods uses it only to sign for the Kernel smart account it owns, never to send.
 * Recovery is automatic: a new device asks the agent for a single-use Shield session.
 */

import type { Storage as OpenfortStorage } from "@openfort/openfort-js";
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

export interface OpenfortEmailSession {
  email: string;
  userId: string;
  token: string;
}

/** The Openfort operations Green Goods uses. The default wraps the SDK; tests pass their own. */
export interface OpenfortWallet {
  /** Ends any stored Openfort session first: a code is never asked for on someone else's behalf. */
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  /** Move an email session verified in the mobile sheet into the shared SDK. */
  acceptEmailSession?(session: OpenfortEmailSession): Promise<void>;
  /** Create the wallet on first sign-in, or recover it on a new device; returns the owner key. */
  configureWallet(): Promise<Hex>;
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

function createOpenfortStorage(publishableKey: string) {
  // Openfort JS scopes its browser storage by the first eight characters after pk_test_/pk_live_.
  const prefix = `${publishableKey.slice(8, 16)}.openfort.`;
  let handoff: Pick<OpenfortEmailSession, "userId" | "token"> | undefined;
  const storage: OpenfortStorage = {
    get: async (key) => localStorage.getItem(key),
    save(key, value) {
      if (handoff && key === `${prefix}authentication`) {
        const saved = JSON.parse(value) as { type?: string; token?: string; userId?: string };
        // The SDK's OAuth handoff encodes the token. The OTP response already carries
        // the bearer token in the form Openfort expects, including any existing escapes.
        if (
          saved.type === "session" &&
          saved.userId === handoff.userId &&
          saved.token === encodeURIComponent(handoff.token)
        ) {
          value = JSON.stringify({ ...saved, token: handoff.token });
        }
      }
      localStorage.setItem(key, value);
    },
    remove: (key) => localStorage.removeItem(key),
    flush() {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) localStorage.removeItem(key);
      }
    },
  };
  return {
    storage,
    async storeEmailSession(auth: OpenfortSdk["auth"], session: OpenfortEmailSession) {
      const { userId, token } = session;
      handoff = { userId, token };
      try {
        await auth.storeCredentials({ userId, token });
      } finally {
        handoff = undefined;
      }
    },
  };
}

let loaded: Promise<{
  sdk: OpenfortSdk;
  module: OpenfortModule;
  storeEmailSession: ReturnType<typeof createOpenfortStorage>["storeEmailSession"];
}> | null = null;

function load() {
  loaded ??= import("@openfort/openfort-js").then((module) => {
    const keys = getOpenfortKeys();
    if (!keys) throw new Error("Email sign-in is not configured");
    const { storage, storeEmailSession } = createOpenfortStorage(keys.publishableKey);
    const sdk = new module.Openfort({
      baseConfiguration: { publishableKey: keys.publishableKey },
      shieldConfiguration: { shieldPublishableKey: keys.shieldPublishableKey },
      overrides: { storage },
      // Openfort's own error reporting stays off: our logger and Sentry own that.
      disableTelemetry: true,
    });
    return { sdk, module, storeEmailSession };
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

  async acceptEmailSession(session) {
    const { sdk, storeEmailSession } = await load();
    await storeEmailSession(sdk.auth, session);
    const user = await sdk.user.get();
    if (user.id !== session.userId || user.email?.trim().toLowerCase() !== session.email) {
      throw new Error("The Openfort email changed during sign-in");
    }
  },

  async configureWallet() {
    const { sdk, module } = await load();
    const token = await sdk.getAccessToken();
    if (!token) throw new Error("Sign in before setting up the wallet");
    const encryptionSession = await fetchRecoverySession(token);
    const account = await sdk.embeddedWallet.configure({
      // Openfort rejects a chain ID for an EOA. The Hub's Kernel account selects the chain.
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
