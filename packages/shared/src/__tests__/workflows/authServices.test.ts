import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import { createActor, type AnyActorLogic } from "xstate";
import type {
  AuthTelemetryAdapter,
  PasskeyAdapters,
  PasskeyServerClientAdapter,
  PasskeySessionAdapter,
} from "../../workflows/auth-passkey-adapters";
import { createAuthServices } from "../../workflows/authServices";

const CHAIN_ID = 11155111;
const USER = "testuser";
const ADDRESS = "0x1111111111111111111111111111111111111111" as Hex;
const OTHER_ADDRESS = "0x9999999999999999999999999999999999999999" as Hex;
const CREDENTIAL: P256Credential = {
  id: "dGVzdC1jcmVkZW50aWFsLWlk",
  publicKey: "0x1234",
  raw: undefined as unknown as PublicKeyCredential,
};
const SERVER_CREDENTIAL = { id: "deadbeef", publicKey: "0xabcd" as Hex };
const AUTH_RESPONSE = { id: "deadbeef", type: "public-key" } as PublicKeyCredential;

async function invoke<T>(logic: AnyActorLogic, input: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const actor = createActor(logic, { input });
    actor.subscribe({
      next: (snapshot) => {
        if (snapshot.status === "done") resolve(snapshot.output as T);
        if (snapshot.status === "error") reject(snapshot.error);
      },
      error: reject,
    });
    actor.start();
  });
}

function createHarness() {
  const state: {
    signedOut: boolean;
    authMode: "passkey" | "wallet" | "embedded" | null;
    credential: P256Credential | null;
    userName: string | null;
    expectedAddress: Hex | null;
    serverEnabled: boolean;
  } = {
    signedOut: false,
    authMode: null,
    credential: null,
    userName: null,
    expectedAddress: null,
    serverEnabled: false,
  };

  const sessionSpies = {
    clearSignedOut: vi.fn(() => {
      state.signedOut = false;
    }),
    setCredential: vi.fn((credential: P256Credential) => {
      state.credential = credential;
    }),
    setUserName: vi.fn((userName: string) => {
      state.userName = userName;
    }),
    setAddress: vi.fn((address: Hex) => {
      state.expectedAddress = address;
    }),
  };
  const session: PasskeySessionAdapter = {
    hasSignedOutSentinel: () => state.signedOut,
    clearSignedOutSentinel: sessionSpies.clearSignedOut,
    getAuthMode: () => state.authMode,
    getStoredCredential: () => state.credential,
    setStoredCredential: sessionSpies.setCredential,
    getStoredUsername: () => state.userName,
    setStoredUsername: sessionSpies.setUserName,
    getStoredSmartAccountAddress: () => state.expectedAddress,
    setStoredSmartAccountAddress: sessionSpies.setAddress,
  };

  const telemetry: AuthTelemetryAdapter = {
    restore: vi.fn(),
    registerStarted: vi.fn(),
    registerSucceeded: vi.fn(),
    registerFailed: vi.fn(),
    loginStarted: vi.fn(),
    loginSucceeded: vi.fn(),
    loginFailed: vi.fn(),
  };
  const server = {
    getCredentials: vi.fn().mockResolvedValue([]),
    startRegistration: vi.fn().mockResolvedValue({ challenge: new Uint8Array([1]) }),
    verifyRegistration: vi.fn().mockResolvedValue({
      success: true,
      id: SERVER_CREDENTIAL.id,
      publicKey: SERVER_CREDENTIAL.publicKey,
      userName: USER,
    }),
    startAuthentication: vi.fn().mockResolvedValue({
      challenge: "0x010203",
      rpId: "localhost",
      userVerification: "required",
      uuid: "auth-uuid",
    }),
    verifyAuthentication: vi.fn().mockResolvedValue({
      success: true,
      id: SERVER_CREDENTIAL.id,
      publicKey: SERVER_CREDENTIAL.publicKey,
      userName: USER,
    }),
  };
  const calls = {
    buildRecoveryContext: vi.fn((userName: string) => ({
      userName: userName.trim().replace(/^@/, "").toLowerCase(),
    })),
    createLocalPasskey: vi.fn().mockResolvedValue(CREDENTIAL),
    createWebAuthnCredential: vi.fn().mockResolvedValue(CREDENTIAL),
    getWebAuthnCredential: vi.fn().mockResolvedValue(AUTH_RESPONSE),
    buildSmartAccount: vi.fn().mockResolvedValue({
      client: { account: { address: ADDRESS } } as unknown as SmartAccountClient,
      address: ADDRESS,
    }),
  };
  const adapters: PasskeyAdapters = {
    session,
    telemetry,
    isServerEnabled: () => state.serverEnabled,
    buildRecoveryContext: calls.buildRecoveryContext,
    createServerClient: () => server as unknown as PasskeyServerClientAdapter,
    createLocalPasskey: (userName) => calls.createLocalPasskey(userName),
    createWebAuthnCredential: (options) => calls.createWebAuthnCredential(options),
    getWebAuthnCredential: (options) => calls.getWebAuthnCredential(options),
    getRpId: () => "localhost",
    randomChallenge: () => new Uint8Array([1, 2, 3]),
    buildSmartAccount: (credential, chainId) => calls.buildSmartAccount(credential, chainId),
  };
  return {
    state,
    sessionSpies,
    telemetry,
    server,
    calls,
    services: createAuthServices(adapters),
  };
}

describe("createAuthServices", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  describe("restoreSession", () => {
    it("does not restore after explicit sign-out", async () => {
      harness.state.credential = CREDENTIAL;
      harness.state.signedOut = true;
      await expect(
        invoke(harness.services.restoreSession, { chainId: CHAIN_ID })
      ).resolves.toBeNull();

      expect(harness.calls.buildSmartAccount).not.toHaveBeenCalled();
    });

    it.each([
      "wallet",
      "embedded",
    ] as const)("does not let a cached passkey override %s session intent", async (authMode) => {
      harness.state.credential = CREDENTIAL;
      harness.state.authMode = authMode;

      await expect(
        invoke(harness.services.restoreSession, { chainId: CHAIN_ID })
      ).resolves.toBeNull();

      expect(harness.calls.buildSmartAccount).not.toHaveBeenCalled();
    });

    it("restores a cached passkey session and refreshes the expected address", async () => {
      harness.state.credential = CREDENTIAL;
      harness.state.userName = USER;

      await expect(
        invoke(harness.services.restoreSession, { chainId: CHAIN_ID })
      ).resolves.toMatchObject({
        credential: CREDENTIAL,
        smartAccountAddress: ADDRESS,
        userName: USER,
      });
      expect(harness.sessionSpies.setAddress).toHaveBeenCalledWith(ADDRESS);
      expect(harness.telemetry.restore).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "success" })
      );
    });

    it("fails closed on expected-address drift without changing cached identity", async () => {
      harness.state.credential = CREDENTIAL;
      harness.state.expectedAddress = OTHER_ADDRESS;

      await expect(
        invoke(harness.services.restoreSession, { chainId: CHAIN_ID })
      ).resolves.toBeNull();
      expect(harness.sessionSpies.setAddress).not.toHaveBeenCalled();
      expect(harness.telemetry.restore).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "failed", reason: "address_mismatch" })
      );
    });
  });

  describe("registerPasskey", () => {
    it("requires a username before invoking any passkey adapter", async () => {
      await expect(
        invoke(harness.services.registerPasskey, { userName: null, chainId: CHAIN_ID })
      ).rejects.toThrow("Username is required");
      expect(harness.calls.createLocalPasskey).not.toHaveBeenCalled();
    });

    it("registers locally, caches identity, and clears sign-out only after success", async () => {
      harness.state.signedOut = true;

      await expect(
        invoke(harness.services.registerPasskey, { userName: USER, chainId: CHAIN_ID })
      ).resolves.toMatchObject({ smartAccountAddress: ADDRESS, userName: USER });
      expect(harness.calls.createLocalPasskey).toHaveBeenCalledWith(USER);
      expect(harness.sessionSpies.setCredential).toHaveBeenCalledWith(CREDENTIAL);
      expect(harness.sessionSpies.clearSignedOut).toHaveBeenCalledTimes(1);
    });

    it("uses the normalized server recovery context and verified credential", async () => {
      harness.state.serverEnabled = true;

      await expect(
        invoke(harness.services.registerPasskey, {
          userName: " @TestUser ",
          chainId: CHAIN_ID,
        })
      ).resolves.toMatchObject({
        credential: expect.objectContaining(SERVER_CREDENTIAL),
        userName: USER,
      });
      expect(harness.server.getCredentials).toHaveBeenCalledWith({ context: { userName: USER } });
      expect(harness.calls.createLocalPasskey).not.toHaveBeenCalled();
    });

    it("fails before ceremony when the recovery context is already registered", async () => {
      harness.state.serverEnabled = true;
      harness.server.getCredentials.mockResolvedValue([SERVER_CREDENTIAL]);

      await expect(
        invoke(harness.services.registerPasskey, { userName: USER, chainId: CHAIN_ID })
      ).rejects.toThrow("already registered");
      expect(harness.server.startRegistration).not.toHaveBeenCalled();
      expect(harness.sessionSpies.setCredential).not.toHaveBeenCalled();
    });
  });

  describe("authenticatePasskey", () => {
    it("authenticates through the local cache and preserves the stored username", async () => {
      harness.state.credential = CREDENTIAL;
      harness.state.userName = "stored-user";

      await expect(
        invoke(harness.services.authenticatePasskey, {
          userName: "mistyped-name",
          chainId: CHAIN_ID,
        })
      ).resolves.toMatchObject({ userName: "stored-user", smartAccountAddress: ADDRESS });
      expect(harness.calls.getWebAuthnCredential).toHaveBeenCalledTimes(1);
    });

    it("keeps sign-out durable when the local ceremony is dismissed", async () => {
      harness.state.credential = CREDENTIAL;
      harness.state.signedOut = true;
      harness.calls.getWebAuthnCredential.mockResolvedValue(null);

      await expect(
        invoke(harness.services.authenticatePasskey, { userName: USER, chainId: CHAIN_ID })
      ).rejects.toThrow("cancelled");
      expect(harness.sessionSpies.clearSignedOut).not.toHaveBeenCalled();
      expect(harness.state.signedOut).toBe(true);
    });

    it("recovers through the hosted server without a local credential", async () => {
      harness.state.serverEnabled = true;
      harness.server.getCredentials.mockResolvedValue([SERVER_CREDENTIAL]);

      await expect(
        invoke(harness.services.authenticatePasskey, { userName: USER, chainId: CHAIN_ID })
      ).resolves.toMatchObject({
        credential: expect.objectContaining(SERVER_CREDENTIAL),
        smartAccountAddress: ADDRESS,
      });
      expect(harness.server.verifyAuthentication).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: "auth-uuid" })
      );
    });

    it("decodes hex credential IDs before the WebAuthn lookup", async () => {
      harness.state.serverEnabled = true;
      harness.server.getCredentials.mockResolvedValue([SERVER_CREDENTIAL]);

      await invoke(harness.services.authenticatePasskey, { userName: USER, chainId: CHAIN_ID });

      const request = harness.calls.getWebAuthnCredential.mock.calls[0]?.[0] as {
        publicKey?: { allowCredentials?: Array<{ id: ArrayBuffer }> };
      };
      expect(
        Array.from(new Uint8Array(request.publicKey?.allowCredentials?.[0]?.id ?? []))
      ).toEqual([0xde, 0xad, 0xbe, 0xef]);
    });

    it("falls back once to a named local credential when the server has no match", async () => {
      harness.state.serverEnabled = true;
      harness.state.credential = CREDENTIAL;
      harness.state.userName = USER;

      await expect(
        invoke(harness.services.authenticatePasskey, { userName: USER, chainId: CHAIN_ID })
      ).resolves.toMatchObject({ credential: CREDENTIAL, userName: USER });
      expect(harness.calls.getWebAuthnCredential).toHaveBeenCalledTimes(1);
      expect(harness.telemetry.loginSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({ source: "local_cache", reason: "legacy_fallback" })
      );
    });

    it("falls back to local cache after a server lookup transport failure", async () => {
      harness.state.serverEnabled = true;
      harness.state.credential = CREDENTIAL;
      harness.state.userName = USER;
      const failure = new Error("HTTP request failed");
      failure.name = "HttpRequestError";
      harness.server.getCredentials.mockRejectedValue(failure);

      await expect(
        invoke(harness.services.authenticatePasskey, { userName: USER, chainId: CHAIN_ID })
      ).resolves.toMatchObject({ credential: CREDENTIAL });
      expect(harness.calls.getWebAuthnCredential).toHaveBeenCalledTimes(1);
    });

    it("does not retry locally after a user cancels the server ceremony", async () => {
      harness.state.serverEnabled = true;
      harness.state.credential = CREDENTIAL;
      harness.server.getCredentials.mockResolvedValue([SERVER_CREDENTIAL]);
      const cancellation = new Error("The operation was not allowed");
      cancellation.name = "NotAllowedError";
      harness.calls.getWebAuthnCredential.mockRejectedValue(cancellation);

      await expect(
        invoke(harness.services.authenticatePasskey, { userName: USER, chainId: CHAIN_ID })
      ).rejects.toThrow("not allowed");
      expect(harness.calls.getWebAuthnCredential).toHaveBeenCalledTimes(1);
      expect(harness.telemetry.loginFailed).toHaveBeenCalledWith(
        expect.objectContaining({ source: "server", reason: "cancelled" })
      );
    });

    it("attributes a dismissed local fallback to local_cache without a second ceremony", async () => {
      harness.state.serverEnabled = true;
      harness.state.credential = CREDENTIAL;
      harness.state.userName = USER;
      const cancellation = new Error("The operation was not allowed");
      cancellation.name = "NotAllowedError";
      harness.calls.getWebAuthnCredential.mockRejectedValue(cancellation);

      await expect(
        invoke(harness.services.authenticatePasskey, { userName: USER, chainId: CHAIN_ID })
      ).rejects.toThrow("not allowed");
      expect(harness.calls.getWebAuthnCredential).toHaveBeenCalledTimes(1);
      expect(harness.telemetry.loginFailed).toHaveBeenCalledWith(
        expect.objectContaining({ source: "local_cache", reason: "cancelled" })
      );
    });

    it("fails closed when a recovered credential rebuilds a different expected address", async () => {
      harness.state.serverEnabled = true;
      harness.state.expectedAddress = OTHER_ADDRESS;
      harness.server.getCredentials.mockResolvedValue([SERVER_CREDENTIAL]);

      await expect(
        invoke(harness.services.authenticatePasskey, { userName: USER, chainId: CHAIN_ID })
      ).rejects.toThrow("did not match the expected account address");
      expect(harness.sessionSpies.setAddress).not.toHaveBeenCalled();
    });
  });
});
