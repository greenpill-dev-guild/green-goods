/** @vitest-environment happy-dom */
/**
 * Email sessions: what a code sign-in stores, what a reload reopens, how the wallet is
 * recovered through the agent, and that nothing signs as the wrong person on a shared phone.
 */

import type { Storage as OpenfortStorage } from "@openfort/openfort-js";
import { keccak256, recoverMessageAddress, toHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

const sdk = vi.hoisted(() => ({
  token: null as string | null,
  state: 1,
  calls: [] as string[],
  configure: vi.fn(),
  verifiedSession: null as { userId: string; email: string; token: string } | null,
  authKey: "project1.openfort.authentication",
}));

vi.mock("@openfort/openfort-js", () => ({
  ChainTypeEnum: { EVM: "EVM" },
  AccountTypeEnum: { EOA: "Externally Owned Account" },
  RecoveryMethod: { AUTOMATIC: "automatic" },
  EmbeddedState: { UNAUTHENTICATED: 1, EMBEDDED_SIGNER_NOT_CONFIGURED: 2, READY: 4 },
  Openfort: class {
    private readonly storage?: OpenfortStorage;
    constructor(options?: { overrides?: { storage?: OpenfortStorage } }) {
      this.storage = options?.overrides?.storage;
    }
    getAccessToken = async () => sdk.token;
    auth = {
      storeCredentials: async ({ userId, token }: { userId: string; token: string }) => {
        // Openfort JS 2.6.4 URL-encodes credentials passed through the OAuth handoff API.
        const value = JSON.stringify({ type: "session", userId, token: encodeURIComponent(token) });
        if (this.storage) this.storage.save(sdk.authKey, value);
        else localStorage.setItem(sdk.authKey, value);
      },
      logout: async () => {
        sdk.calls.push("logout");
        sdk.token = null;
      },
      requestEmailOtp: async ({ email }: { email: string }) => {
        sdk.calls.push(`requestEmailOtp:${email}:${sdk.token ? "while-signed-in" : "signed-out"}`);
      },
    };
    user = {
      get: async () => {
        const stored = this.storage
          ? await this.storage.get(sdk.authKey)
          : localStorage.getItem(sdk.authKey);
        const verified = sdk.verifiedSession;
        if (!stored || !verified || JSON.parse(stored).token !== verified.token) {
          throw new Error("Session expired or revoked");
        }
        return { id: verified.userId, email: verified.email };
      },
    };
    embeddedWallet = { configure: sdk.configure };
  },
}));

vi.mock("../../config/openfort", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../config/openfort")>()),
  getOpenfortKeys: () => ({
    publishableKey: "pk_test_project1",
    shieldPublishableKey: "shield_pk",
  }),
  getOpenfortRecoveryUrl: () => "https://agent.test/public/auth/openfort/recovery-session",
}));

import {
  createOpenfortOwner,
  getStoredOpenfortAccount,
  OpenfortOwnerMismatchError,
} from "../../modules/auth/openfort-account";
import {
  defaultOpenfortWallet,
  OpenfortRecoveryUnavailableError,
  type OpenfortWallet,
} from "../../modules/auth/openfort-wallet";
import { getAuthMode, hasSignedOutSentinel, setAuthMode } from "../../modules/auth/session";
import { publishSignOut } from "../../modules/auth/sessionSignOut";
import {
  createOpenfortSessionServices,
  normalizeEmail,
} from "../../workflows/auth-openfort-session";

const CHAIN_ID = 42161;
const OWNER = privateKeyToAccount(generatePrivateKey());
// The repo registers viem's Address as a string; owner addresses here are hex.
const OWNER_ADDRESS = OWNER.address as Hex;
const ACCOUNT = "0x00000000000000000000000000000000000000aa" as Hex;

function fakeWallet(overrides: Partial<OpenfortWallet> = {}): OpenfortWallet & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    requestCode: vi.fn(async () => void calls.push("requestCode")),
    verifyCode: vi.fn(async () => void calls.push("verifyCode")),
    configureWallet: vi.fn(async () => {
      calls.push("configureWallet");
      return OWNER_ADDRESS;
    }),
    currentOwnerAddress: vi.fn(async (): Promise<Hex | null> => OWNER_ADDRESS),
    hasStoredSession: vi.fn(async () => true),
    signMessage: vi.fn(async (message: Hex | string, raw: boolean) =>
      OWNER.signMessage({ message: raw ? { raw: message as Hex } : (message as string) })
    ),
    signTypedData: vi.fn(async () => "0x" as Hex),
    signOut: vi.fn(async () => void calls.push("signOut")),
    ...overrides,
  };
}

function services(wallet: OpenfortWallet) {
  return createOpenfortSessionServices({
    wallet,
    buildSmartAccount: async () => ({
      client: { account: { address: ACCOUNT } } as any,
      address: ACCOUNT,
    }),
  });
}

function run<T>(logic: any, input: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const actor = createActor(logic, { input });
    actor.subscribe({
      complete: () => resolve(actor.getSnapshot().output as T),
      error: reject,
    });
    actor.start();
  });
}

const signIn = {
  email: " Gardener@Example.com ",
  code: " 123456 ",
  chainId: CHAIN_ID,
};

beforeEach(() => {
  localStorage.clear();
  sdk.token = null;
  sdk.calls = [];
  sdk.verifiedSession = null;
  sdk.configure.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("email sign-in", () => {
  it("opens the same sponsored account after the mobile sheet verifies the email", async () => {
    const acceptEmailSession = vi.fn(async () => {});
    const wallet = fakeWallet({ acceptEmailSession });
    const session = { email: " Gardener@Example.com ", userId: "user-1", token: "test-token" };

    const opened = await run(services(wallet).authenticateOpenfort, {
      session,
      chainId: CHAIN_ID,
    });

    expect(acceptEmailSession).toHaveBeenCalledWith({ ...session, email: "gardener@example.com" });
    expect(wallet.verifyCode).not.toHaveBeenCalled();
    expect(opened).toMatchObject({
      smartAccountAddress: ACCOUNT,
      userName: "gardener@example.com",
    });
    expect(getStoredOpenfortAccount()).toMatchObject({
      smartAccountAddress: ACCOUNT,
      email: "gardener@example.com",
    });
  });

  it("clears a refused mobile email session before it can open a wallet", async () => {
    const error = new Error("Email mismatch");
    const wallet = fakeWallet({
      acceptEmailSession: vi.fn().mockRejectedValue(error),
    });

    await expect(
      run(services(wallet).authenticateOpenfort, {
        session: { email: "gardener@example.com", userId: "user-1", token: "test-token" },
        chainId: CHAIN_ID,
      })
    ).rejects.toThrow(error);
    expect(wallet.configureWallet).not.toHaveBeenCalled();
    expect(wallet.signOut).toHaveBeenCalledOnce();
    expect(getStoredOpenfortAccount()).toBeNull();
  });

  it("verifies the code, recovers the wallet and keeps a record of whose account opened", async () => {
    const wallet = fakeWallet();
    const session = await run<any>(services(wallet).authenticateOpenfort, signIn);

    expect(wallet.verifyCode).toHaveBeenCalledWith("gardener@example.com", "123456");
    expect(wallet.calls).toEqual(["verifyCode", "configureWallet"]);
    expect(session).toMatchObject({
      smartAccountAddress: ACCOUNT,
      userName: "gardener@example.com",
    });
    expect(getStoredOpenfortAccount()).toEqual({
      ownerAddress: OWNER.address,
      smartAccountAddress: ACCOUNT,
      method: "email",
      email: "gardener@example.com",
    });
  });

  it("signs Openfort out when the wallet cannot be set up after the code was accepted", async () => {
    const wallet = fakeWallet({
      configureWallet: vi.fn(async () => {
        throw new OpenfortRecoveryUnavailableError("provider_unavailable");
      }),
    });
    await expect(run(services(wallet).authenticateOpenfort, signIn)).rejects.toThrow(
      "Account recovery is unavailable"
    );
    expect(wallet.signOut).toHaveBeenCalled();
    expect(getStoredOpenfortAccount()).toBeNull();
  });

  it("keeps nothing from a sign-in that outlived a sign-out", async () => {
    const wallet = fakeWallet({
      verifyCode: vi.fn(async () => {
        publishSignOut();
      }),
    });
    await expect(run(services(wallet).authenticateOpenfort, signIn)).rejects.toThrow(
      "Session ended during authentication"
    );
    expect(getStoredOpenfortAccount()).toBeNull();
    expect(wallet.signOut).toHaveBeenCalled();
  });

  it("reopens the saved account on reload without Openfort, and only for an email session", async () => {
    const wallet = fakeWallet({
      hasStoredSession: vi.fn(async () => Promise.reject(new Error("offline"))),
    });
    const { authenticateOpenfort, restoreOpenfort } = services(fakeWallet());
    await run(authenticateOpenfort, signIn);

    // No saved email intent: nothing to restore.
    await expect(run(services(wallet).restoreOpenfort, { chainId: CHAIN_ID })).resolves.toBeNull();

    setAuthMode("openfort");
    // Offline, the wallet cannot load, but the record still says whose account this is.
    await expect(
      run(services(wallet).restoreOpenfort, { chainId: CHAIN_ID })
    ).resolves.toMatchObject({
      smartAccountAddress: ACCOUNT,
      userName: "gardener@example.com",
    });

    // Openfort signed out elsewhere: this device forgets the account too.
    const signedOutElsewhere = fakeWallet({ hasStoredSession: vi.fn(async () => false) });
    await expect(
      run(services(signedOutElsewhere).restoreOpenfort, { chainId: CHAIN_ID })
    ).resolves.toBeNull();
    expect(getStoredOpenfortAccount()).toBeNull();
    await expect(run(restoreOpenfort, { chainId: CHAIN_ID })).resolves.toBeNull();
  });

  /** A sign-in whose code is never answered: the page closed, or it is still in flight. */
  function startSignIn() {
    let acceptCode = () => {};
    const wallet = fakeWallet({
      verifyCode: vi.fn(() => new Promise<void>((resolve) => (acceptCode = resolve))),
    });
    const result = run<{ smartAccountAddress: Hex }>(services(wallet).authenticateOpenfort, signIn);
    setAuthMode("openfort"); // Auth saves the mode as the sign-in starts, before any record
    return { acceptCode: () => acceptCode(), result };
  }

  it("leaves alone a sign-in that another tab has in flight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const signingIn = startSignIn();

    const otherTab = fakeWallet();
    vi.setSystemTime(Date.now() + 60_000); // a slow network, still within a sign-in's time
    await expect(
      run(services(otherTab).restoreOpenfort, { chainId: CHAIN_ID })
    ).resolves.toBeNull();
    expect(otherTab.signOut).not.toHaveBeenCalled();
    expect(getAuthMode()).toBe("openfort");

    signingIn.acceptCode();
    await expect(signingIn.result).resolves.toMatchObject({ smartAccountAddress: ACCOUNT });
  });

  it("ends the Openfort session a sign-in left when the page closed before the account opened", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    startSignIn(); // never answered: the page closed

    const nextLoad = fakeWallet();
    vi.setSystemTime(Date.now() + 3 * 60_000);
    await expect(
      run(services(nextLoad).restoreOpenfort, { chainId: CHAIN_ID })
    ).resolves.toBeNull();
    expect(nextLoad.signOut).toHaveBeenCalledTimes(1);
    // The device stays signed out: nothing else reopens on the next load either.
    expect(getAuthMode()).toBeNull();
    expect(hasSignedOutSentinel()).toBe(true);
  });

  it("ends that session as soon as someone signs in another way on this phone", async () => {
    const nextPerson = fakeWallet();
    const { endUnfinishedSignIn } = services(nextPerson);
    // No email sign-in started here: a passkey or wallet session touches nothing at Openfort.
    endUnfinishedSignIn();
    expect(nextPerson.signOut).not.toHaveBeenCalled();

    startSignIn(); // the page closed; the next person picks a passkey within two minutes
    endUnfinishedSignIn();
    expect(nextPerson.signOut).toHaveBeenCalledTimes(1);
  });

  it("renews its mark as a slow sign-in moves on, so another tab never takes it as abandoned", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let acceptCode = () => {};
    const slow = fakeWallet({
      verifyCode: vi.fn(() => new Promise<void>((resolve) => (acceptCode = resolve))),
      configureWallet: vi.fn(() => new Promise<Hex>(() => {})), // the network stalls here
    });
    void run(services(slow).authenticateOpenfort, signIn);
    setAuthMode("openfort");
    vi.setSystemTime(Date.now() + 90_000);
    acceptCode();
    await new Promise((resolve) => setTimeout(resolve, 0));

    vi.setSystemTime(Date.now() + 90_000); // three minutes in, 90 seconds after its last step
    const otherTab = fakeWallet();
    await run(services(otherTab).restoreOpenfort, { chainId: CHAIN_ID });
    expect(otherTab.signOut).not.toHaveBeenCalled();
    expect(getAuthMode()).toBe("openfort");
  });

  it("keeps no mark of a sign-in that failed, so the next load cleans up at once", async () => {
    const refused = fakeWallet({
      verifyCode: vi.fn(async () => Promise.reject(new Error("Invalid code"))),
    });
    await expect(run(services(refused).authenticateOpenfort, signIn)).rejects.toThrow(
      "Invalid code"
    );
    setAuthMode("openfort");
    const nextLoad = fakeWallet();
    await run(services(nextLoad).restoreOpenfort, { chainId: CHAIN_ID });
    expect(nextLoad.signOut).toHaveBeenCalledTimes(1);
  });

  it("asks for a new code only after a cleanup sign-out has finished", async () => {
    let finishSignOut = () => {};
    const wallet = fakeWallet({
      signOut: vi.fn(() => new Promise<void>((resolve) => (finishSignOut = resolve))),
    });
    const { requestCode, endUnfinishedSignIn } = services(wallet);
    startSignIn();
    endUnfinishedSignIn();
    const asked = requestCode("next@example.com");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wallet.requestCode).not.toHaveBeenCalled();
    finishSignOut();
    await asked;
    expect(wallet.requestCode).toHaveBeenCalledWith("next@example.com");
  });

  it("normalizes what was typed so the same person always reaches the same account", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("the Openfort owner", () => {
  it("signs a raw hash the way the Kernel validator checks it", async () => {
    const owner = createOpenfortOwner(fakeWallet(), OWNER_ADDRESS);
    const raw = keccak256(toHex("user operation"));
    const signature = await owner.signMessage({ message: { raw } });
    expect(await recoverMessageAddress({ message: { raw }, signature })).toBe(OWNER.address);
  });

  it("recovers a lost signer before signing, and refuses to sign as anyone else", async () => {
    const lost = fakeWallet({ currentOwnerAddress: vi.fn(async () => null) });
    await createOpenfortOwner(lost, OWNER_ADDRESS).signMessage({ message: "hello" });
    expect(lost.configureWallet).toHaveBeenCalledWith();

    const someoneElse = privateKeyToAccount(generatePrivateKey()).address as Hex;
    const switched = fakeWallet({
      currentOwnerAddress: vi.fn(async (): Promise<Hex | null> => someoneElse),
    });
    await expect(
      createOpenfortOwner(switched, OWNER_ADDRESS).signMessage({ message: "hello" })
    ).rejects.toBeInstanceOf(OpenfortOwnerMismatchError);
    expect(switched.signMessage).not.toHaveBeenCalled();
  });
});

describe("the Openfort wallet adapter", () => {
  it("ends a stored Openfort session before asking for a code, so a code never links someone else", async () => {
    sdk.token = "previous-person";
    await defaultOpenfortWallet.requestCode("next@example.com");
    expect(sdk.calls).toEqual(["logout", "requestEmailOtp:next@example.com:signed-out"]);
  });

  it("preserves the verified email token through the SDK handoff", async () => {
    const session = {
      email: "gardener@example.com",
      userId: "user-1",
      token: "session.synthetic%2B%2F%3D",
    };
    sdk.verifiedSession = session;

    await expect(defaultOpenfortWallet.acceptEmailSession?.(session)).resolves.toBeUndefined();
    expect(JSON.parse(localStorage.getItem(sdk.authKey) ?? "{}")).toEqual({
      type: "session",
      userId: session.userId,
      token: session.token,
    });
  });

  it("configures a chain-independent wallet using a recovery session for the signed-in user", async () => {
    sdk.token = "person-token";
    const fetchMock = vi.fn(async () => Response.json({ ok: true, session: "encryption-session" }));
    vi.stubGlobal("fetch", fetchMock);
    sdk.configure.mockResolvedValue({ address: OWNER.address });

    await expect(defaultOpenfortWallet.configureWallet()).resolves.toBe(OWNER.address);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/public/auth/openfort/recovery-session",
      expect.objectContaining({ method: "POST", headers: { authorization: "Bearer person-token" } })
    );
    expect(sdk.configure).toHaveBeenCalledWith({
      chainType: "EVM",
      accountType: "Externally Owned Account",
      recoveryParams: { recoveryMethod: "automatic", encryptionSession: "encryption-session" },
    });
  });

  it("does not set up a wallet when the agent refuses recovery", async () => {
    sdk.token = "person-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { ok: false, errorCode: "provider_unavailable", message: "off" },
          { status: 503 }
        )
      )
    );
    await expect(defaultOpenfortWallet.configureWallet()).rejects.toMatchObject({
      reason: "provider_unavailable",
    });
    expect(sdk.configure).not.toHaveBeenCalled();
  });
});
