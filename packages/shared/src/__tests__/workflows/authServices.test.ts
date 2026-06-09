/**
 * Auth Services Integration Tests
 *
 * Tests the async services that power the auth machine with Pimlico server:
 * - restoreSessionService: Restore session from Pimlico server using stored username
 * - registerPasskeyService: Create new passkey and store on Pimlico server
 * - authenticatePasskeyService: Login with passkey from Pimlico server
 * (claimENSService was removed — ENS claiming is now a standalone mutation hook)
 *
 * Note: These services are XState 5 `fromPromise` actors. To test them,
 * we create a minimal test machine and verify the service behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, fromPromise, setup } from "xstate";

// ============================================================================
// GLOBAL SETUP (before tests)
// ============================================================================

// Mock localStorage
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() {
      return Object.keys(store).length;
    },
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
};

// Setup global mocks immediately
const globalMockLocalStorage = createMockLocalStorage();
Object.defineProperty(global, "localStorage", {
  value: globalMockLocalStorage,
  writable: true,
  configurable: true,
});

// Mock window
if (typeof global.window === "undefined") {
  (global as any).window = {};
}
Object.defineProperty(global.window, "location", {
  value: { hostname: "localhost" },
  writable: true,
  configurable: true,
});

// Mock navigator
if (typeof global.navigator === "undefined") {
  (global as any).navigator = {};
}
// Ensure window.navigator points to global.navigator
(global as any).window.navigator = global.navigator;

// ============================================================================
// MOCKS
// ============================================================================

// Mock viem/account-abstraction
vi.mock("viem/account-abstraction", () => ({
  createWebAuthnCredential: vi.fn(),
  toWebAuthnAccount: vi.fn(() => ({ address: "0xWebAuthnAccount" })),
  entryPoint07Address: "0x0000000000000000000000000000000000000007",
}));

// Mock permissionless
vi.mock("permissionless", () => ({
  createSmartAccountClient: vi.fn(() => ({
    account: { address: "0xSmartAccount123456789012345678901234567890" },
    sendTransaction: vi.fn().mockResolvedValue("0xtxhash"),
  })),
}));

// Mock permissionless/accounts
vi.mock("permissionless/accounts", () => ({
  toKernelSmartAccount: vi.fn(() =>
    Promise.resolve({ address: "0xSmartAccount123456789012345678901234567890" })
  ),
}));

// Mock config modules
vi.mock("../../config/chains", () => ({
  getChain: vi.fn(() => ({ id: 11155111, name: "Sepolia" })),
}));

vi.mock("../../config/pimlico", () => ({
  createPimlicoClientForChain: vi.fn(() => ({
    getUserOperationGasPrice: vi.fn(() =>
      Promise.resolve({
        fast: { maxFeePerGas: BigInt(1000000), maxPriorityFeePerGas: BigInt(100000) },
      })
    ),
  })),
  createPublicClientForChain: vi.fn(() => ({})),
  getPimlicoBundlerUrl: vi.fn(() => "https://bundler.test"),
}));

// Mock Pimlico passkey server client
const mockPasskeyServerClient = {
  chain: { id: 11155111, name: "Sepolia" },
  baseUrl: "https://api.pimlico.io/v2/11155111/rpc",
  startRegistration: vi.fn(),
  verifyRegistration: vi.fn(),
  startAuthentication: vi.fn(),
  verifyAuthentication: vi.fn(),
  getCredentials: vi.fn(),
};

let mockPasskeyServerEnabled = false;

vi.mock("../../config/passkeyServer", () => ({
  createPasskeyServerClient: vi.fn(() => mockPasskeyServerClient),
  createPasskey: vi.fn(),
  buildPasskeyRecoveryContext: vi.fn((userName: string) => ({
    username: userName.trim().replace(/^@/, "").toLowerCase(),
  })),
  getPasskeyRpId: vi.fn(() => "localhost"),
  isPasskeyServerEnabled: vi.fn(() => mockPasskeyServerEnabled),
  PASSKEY_RP_ID: "greengoods.app",
  PASSKEY_RP_NAME: "Green Goods",
}));

// Mocked session functions
let mockStoredUsername: string | null = null;
let mockStoredCredential: unknown = null;
let mockAuthMode: "passkey" | "wallet" | "embedded" | null = null;
let mockStoredSmartAccountAddress: string | null = null;
vi.mock("../../modules/auth/session", () => ({
  getAuthMode: vi.fn(() => mockAuthMode),
  setAuthMode: vi.fn((mode: "passkey" | "wallet" | "embedded") => {
    mockAuthMode = mode;
  }),
  clearAuthMode: vi.fn(() => {
    mockAuthMode = null;
  }),
  getStoredUsername: vi.fn(() => mockStoredUsername),
  setStoredUsername: vi.fn((u: string) => {
    mockStoredUsername = u;
  }),
  clearStoredUsername: vi.fn(() => {
    mockStoredUsername = null;
  }),
  getStoredCredential: vi.fn(() => mockStoredCredential),
  setStoredCredential: vi.fn((c: unknown) => {
    mockStoredCredential = c;
  }),
  clearStoredCredential: vi.fn(() => {
    mockStoredCredential = null;
  }),
  getStoredSmartAccountAddress: vi.fn(() => mockStoredSmartAccountAddress),
  setStoredSmartAccountAddress: vi.fn((address: string) => {
    mockStoredSmartAccountAddress = address;
  }),
  clearStoredSmartAccountAddress: vi.fn(() => {
    mockStoredSmartAccountAddress = null;
  }),
  setStoredRpId: vi.fn(),
  USERNAME_STORAGE_KEY: "greengoods_username",
}));

// Import after mocks
import { createWebAuthnCredential } from "viem/account-abstraction";
import { createPasskey } from "../../config/passkeyServer";
import {
  clearAuthMode,
  clearStoredCredential,
  clearStoredSmartAccountAddress,
  clearStoredUsername,
  setStoredSmartAccountAddress,
  setStoredUsername,
} from "../../modules/auth/session";
import {
  authenticatePasskeyService,
  registerPasskeyService,
  restoreSessionService,
} from "../../workflows/authServices";

// ============================================================================
// TEST HELPERS
// ============================================================================

const MOCK_CHAIN_ID = 11155111;
const MOCK_USERNAME = "testuser";
const MOCK_SMART_ACCOUNT_ADDRESS = "0xSmartAccount123456789012345678901234567890";
const MOCK_OTHER_SMART_ACCOUNT_ADDRESS = "0x9999999999999999999999999999999999999999";

const MOCK_CREDENTIAL = {
  id: "dGVzdC1jcmVkZW50aWFsLWlk", // Base64URL encoded "test-credential-id"
  publicKey: "0xTestPublicKey1234567890" as `0x${string}`,
  raw: {
    id: "dGVzdC1jcmVkZW50aWFsLWlk",
    type: "public-key",
    rawId: new Uint8Array([1, 2, 3, 4]),
  } as unknown as PublicKeyCredential,
};

const MOCK_SERVER_CREDENTIAL = {
  id: "c2VydmVyLWNyZWRlbnRpYWwtaWQ",
  publicKey: "0xServerPublicKey1234567890" as `0x${string}`,
};

const MOCK_SERVER_CONTEXT = { username: MOCK_USERNAME };

/**
 * Helper to invoke a fromPromise actor and get the result
 */
async function invokeService<TOutput, TInput>(
  service: ReturnType<typeof fromPromise<TOutput, TInput>>,
  input: TInput
): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    const testMachine = setup({
      types: {
        context: {} as { result: TOutput | null; error: unknown },
        events: {} as { type: "done" },
      },
      actors: { testService: service },
    }).createMachine({
      id: "test",
      initial: "running",
      context: { result: null, error: null },
      states: {
        running: {
          invoke: {
            src: "testService",
            input: () => input,
            onDone: {
              target: "done",
              actions: ({ context, event }) => {
                context.result = event.output;
              },
            },
            onError: {
              target: "error",
              actions: ({ context, event }) => {
                context.error = event.error;
              },
            },
          } as any,
        },
        done: { type: "final" },
        error: { type: "final" },
      },
    });

    const actor = createActor(testMachine);

    actor.subscribe({
      complete: () => {
        const snapshot = actor.getSnapshot();
        if (snapshot.matches("error")) {
          reject(snapshot.context.error);
        } else {
          resolve(snapshot.context.result as TOutput);
        }
      },
    });

    actor.start();
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe("workflows/authServices (Pimlico Server Flow)", () => {
  let mockCredentials: {
    create: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoredUsername = null;
    mockStoredCredential = null;
    mockAuthMode = null;
    mockStoredSmartAccountAddress = null;
    mockPasskeyServerEnabled = false;
    globalMockLocalStorage.clear();
    globalMockLocalStorage._setStore({});

    // Reset Pimlico server mock
    mockPasskeyServerClient.startRegistration.mockReset();
    mockPasskeyServerClient.verifyRegistration.mockReset();
    mockPasskeyServerClient.startAuthentication.mockReset();
    mockPasskeyServerClient.verifyAuthentication.mockReset();
    mockPasskeyServerClient.getCredentials.mockReset();

    // Setup navigator.credentials mock
    mockCredentials = {
      create: vi.fn(),
      get: vi.fn(),
    };
    Object.defineProperty(global.navigator, "credentials", {
      value: mockCredentials,
      writable: true,
      configurable: true,
    });
    (global as any).window.navigator = global.navigator;

    // Setup window.location
    Object.defineProperty(global.window, "location", {
      value: { hostname: "localhost" },
      writable: true,
      configurable: true,
    });

    // Reset crypto mock
    Object.defineProperty(global, "crypto", {
      value: {
        getRandomValues: vi.fn((arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // RESTORE SESSION SERVICE (Client-Only Storage)
  // ==========================================================================

  describe("restoreSessionService (Client-Only Storage)", () => {
    it("returns null when no stored credential", async () => {
      mockStoredCredential = null;

      const result = await invokeService(restoreSessionService, {
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).toBeNull();
    });

    it("restores session from stored credential", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockStoredUsername = MOCK_USERNAME;

      const result = await invokeService(restoreSessionService, {
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).not.toBeNull();
      expect(result?.credential).toEqual(MOCK_CREDENTIAL);
      expect(result?.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
      expect(result?.userName).toBe(MOCK_USERNAME);
    });

    it("returns result with empty username when no stored username", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockStoredUsername = null;

      const result = await invokeService(restoreSessionService, {
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).not.toBeNull();
      expect(result?.userName).toBe("");
    });

    // Bug fix: Prevent passkey from hijacking wallet sessions
    it("returns null when authMode is wallet even if credential exists", async () => {
      // This is the key bug scenario:
      // 1. User has stored credential (from previous passkey login)
      // 2. User signed out and logged in with wallet (authMode = "wallet")
      // 3. On refresh, restoreSession should NOT restore passkey session
      mockStoredCredential = MOCK_CREDENTIAL;
      mockStoredUsername = MOCK_USERNAME;
      mockAuthMode = "wallet";

      const result = await invokeService(restoreSessionService, {
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).toBeNull();
    });

    it("restores session when authMode is passkey", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockStoredUsername = MOCK_USERNAME;
      mockAuthMode = "passkey";

      const result = await invokeService(restoreSessionService, {
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).not.toBeNull();
      expect(result?.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
    });

    it("restores session when authMode is null (legacy or fresh state)", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockStoredUsername = MOCK_USERNAME;
      mockAuthMode = null;

      const result = await invokeService(restoreSessionService, {
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).not.toBeNull();
      expect(result?.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
    });
  });

  // ==========================================================================
  // REGISTER PASSKEY SERVICE (Client-Only)
  // ==========================================================================

  describe("registerPasskeyService (Client-Only)", () => {
    it("throws when username is missing", async () => {
      await expect(
        invokeService(registerPasskeyService, {
          userName: null,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("Username is required for registration");
    });

    it("creates credential and stores username", async () => {
      (createPasskey as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      const result = await invokeService(registerPasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(createPasskey).toHaveBeenCalledWith(MOCK_USERNAME);
      expect(setStoredUsername).toHaveBeenCalledWith(MOCK_USERNAME);
      expect(result.credential).toEqual(MOCK_CREDENTIAL);
      expect(result.userName).toBe(MOCK_USERNAME);
      expect(result.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
    });

    it("stores username locally after successful registration", async () => {
      (createPasskey as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      await invokeService(registerPasskeyService, {
        userName: "alice",
        chainId: MOCK_CHAIN_ID,
      });

      expect(setStoredUsername).toHaveBeenCalledWith("alice");
    });

    it("builds smart account from registered credential", async () => {
      (createPasskey as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      const result = await invokeService(registerPasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result.smartAccountClient).toBeDefined();
      expect(result.smartAccountClient.account.address).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
    });
  });

  // ==========================================================================
  // REGISTER PASSKEY SERVICE (Pimlico Hosted Passkey Server)
  // ==========================================================================

  describe("registerPasskeyService (Passkey Server Enabled)", () => {
    beforeEach(() => {
      mockPasskeyServerEnabled = true;
      mockPasskeyServerClient.startRegistration.mockResolvedValue({
        rp: { id: "localhost", name: "Green Goods" },
        user: {
          id: new Uint8Array([1, 2, 3]),
          name: MOCK_USERNAME,
          displayName: MOCK_USERNAME,
        },
        challenge: new Uint8Array([4, 5, 6]),
      });
      mockPasskeyServerClient.verifyRegistration.mockResolvedValue({
        success: true,
        id: MOCK_SERVER_CREDENTIAL.id,
        publicKey: MOCK_SERVER_CREDENTIAL.publicKey,
        userName: MOCK_USERNAME,
      });
      mockPasskeyServerClient.getCredentials.mockResolvedValue([]);
      (createWebAuthnCredential as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);
    });

    it("registers with the normalized recovery context and caches the verified credential", async () => {
      const result = await invokeService(registerPasskeyService, {
        userName: " @TestUser ",
        chainId: MOCK_CHAIN_ID,
      });

      expect(mockPasskeyServerClient.startRegistration).toHaveBeenCalledWith({
        context: MOCK_SERVER_CONTEXT,
      });
      expect(createWebAuthnCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          rp: { id: "localhost", name: "Green Goods" },
          user: expect.objectContaining({ name: MOCK_USERNAME }),
        })
      );
      expect(mockPasskeyServerClient.verifyRegistration).toHaveBeenCalledWith({
        credential: MOCK_CREDENTIAL,
        context: MOCK_SERVER_CONTEXT,
      });
      expect(createPasskey).not.toHaveBeenCalled();
      expect(setStoredUsername).toHaveBeenCalledWith(MOCK_USERNAME);
      expect(setStoredSmartAccountAddress).toHaveBeenCalledWith(MOCK_SMART_ACCOUNT_ADDRESS);
      expect(result.credential).toEqual({
        id: MOCK_SERVER_CREDENTIAL.id,
        publicKey: MOCK_SERVER_CREDENTIAL.publicKey,
        raw: MOCK_CREDENTIAL.raw,
      });
      expect(result.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
      expect(result.userName).toBe(MOCK_USERNAME);
    });

    it("fails before registration when the recovery context is already registered", async () => {
      mockPasskeyServerClient.getCredentials.mockResolvedValue([MOCK_SERVER_CREDENTIAL]);

      await expect(
        invokeService(registerPasskeyService, {
          userName: MOCK_USERNAME,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("That recovery name is already registered");

      expect(mockPasskeyServerClient.startRegistration).not.toHaveBeenCalled();
      expect(createWebAuthnCredential).not.toHaveBeenCalled();
      expect(setStoredUsername).not.toHaveBeenCalled();
      expect(setStoredSmartAccountAddress).not.toHaveBeenCalled();
    });

    it("fails closed when the passkey server does not verify registration", async () => {
      mockPasskeyServerClient.verifyRegistration.mockResolvedValue({
        success: false,
        id: MOCK_SERVER_CREDENTIAL.id,
        publicKey: MOCK_SERVER_CREDENTIAL.publicKey,
        userName: MOCK_USERNAME,
      });

      await expect(
        invokeService(registerPasskeyService, {
          userName: MOCK_USERNAME,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("Passkey server registration failed");

      expect(setStoredUsername).not.toHaveBeenCalled();
      expect(setStoredSmartAccountAddress).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // AUTHENTICATE PASSKEY SERVICE (Client-Only)
  // ==========================================================================

  describe("authenticatePasskeyService (Client-Only)", () => {
    it("throws when no stored credential", async () => {
      mockStoredCredential = null;

      await expect(
        invokeService(authenticatePasskeyService, {
          userName: MOCK_USERNAME,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("No passkey found. Please create a new account.");
    });

    it("reads credential from localStorage and prompts biometric", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(mockCredentials.get).toHaveBeenCalled();
      expect(result.credential).toBeDefined();
      expect(result.smartAccountClient).toBeDefined();
      expect(result.userName).toBe(MOCK_USERNAME);
    });

    it("stores username after successful authentication", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      await invokeService(authenticatePasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(setStoredUsername).toHaveBeenCalledWith(MOCK_USERNAME);
    });

    it("throws when biometric authentication is cancelled", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockCredentials.get.mockResolvedValue(null); // User cancelled

      await expect(
        invokeService(authenticatePasskeyService, {
          userName: MOCK_USERNAME,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("Passkey authentication was cancelled");
    });

    it("prompts WebAuthn with correct credential ID from storage", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      await invokeService(authenticatePasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(mockCredentials.get).toHaveBeenCalledWith({
        publicKey: expect.objectContaining({
          rpId: "localhost",
          userVerification: "required",
          timeout: 60000,
          allowCredentials: expect.arrayContaining([
            expect.objectContaining({ type: "public-key" }),
          ]),
        }),
      });
    });
  });

  // ==========================================================================
  // AUTHENTICATE PASSKEY SERVICE (Pimlico Hosted Passkey Server)
  // ==========================================================================

  describe("authenticatePasskeyService (Passkey Server Enabled)", () => {
    beforeEach(() => {
      mockPasskeyServerEnabled = true;
      mockPasskeyServerClient.getCredentials.mockResolvedValue([MOCK_SERVER_CREDENTIAL]);
      mockPasskeyServerClient.startAuthentication.mockResolvedValue({
        challenge: "0x010203",
        rpId: "localhost",
        userVerification: "required",
        uuid: "server-auth-uuid",
      });
      mockPasskeyServerClient.verifyAuthentication.mockResolvedValue({
        success: true,
        id: MOCK_SERVER_CREDENTIAL.id,
        publicKey: MOCK_SERVER_CREDENTIAL.publicKey,
        userName: MOCK_USERNAME,
      });
      mockCredentials.get.mockResolvedValue({
        id: MOCK_SERVER_CREDENTIAL.id,
        rawId: new Uint8Array([7, 8, 9]),
        type: "public-key",
        response: {
          clientDataJSON: new Uint8Array([1]),
          authenticatorData: new Uint8Array([2]),
          signature: new Uint8Array([3]),
          userHandle: new Uint8Array([4]),
        },
        authenticatorAttachment: "platform",
        getClientExtensionResults: () => ({}),
      });
    });

    it("recovers without a local credential by looking up the normalized username", async () => {
      mockStoredCredential = null;

      const result = await invokeService(authenticatePasskeyService, {
        userName: " TestUser ",
        chainId: MOCK_CHAIN_ID,
      });

      expect(mockPasskeyServerClient.getCredentials).toHaveBeenCalledWith({
        context: MOCK_SERVER_CONTEXT,
      });
      expect(mockPasskeyServerClient.startAuthentication).toHaveBeenCalled();
      expect(mockCredentials.get).toHaveBeenCalledWith({
        publicKey: expect.objectContaining({
          rpId: "localhost",
          userVerification: "required",
          timeout: 60000,
          allowCredentials: [
            expect.objectContaining({
              type: "public-key",
              transports: ["internal", "hybrid"],
            }),
          ],
        }),
      });
      expect(mockPasskeyServerClient.verifyAuthentication).toHaveBeenCalledWith(
        expect.objectContaining({
          raw: expect.objectContaining({ id: MOCK_SERVER_CREDENTIAL.id }),
          uuid: "server-auth-uuid",
        })
      );
      expect(setStoredUsername).toHaveBeenCalledWith(MOCK_USERNAME);
      expect(setStoredSmartAccountAddress).toHaveBeenCalledWith(MOCK_SMART_ACCOUNT_ADDRESS);
      expect(result.credential).toEqual({
        id: MOCK_SERVER_CREDENTIAL.id,
        publicKey: MOCK_SERVER_CREDENTIAL.publicKey,
        raw: expect.objectContaining({ id: MOCK_SERVER_CREDENTIAL.id }),
      });
      expect(result.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
      expect(result.userName).toBe(MOCK_USERNAME);
    });

    it("decodes hex credential IDs from the passkey server before WebAuthn lookup", async () => {
      mockStoredCredential = null;
      mockPasskeyServerClient.getCredentials.mockResolvedValue([
        {
          id: "deadbeef",
          publicKey: MOCK_SERVER_CREDENTIAL.publicKey,
        },
      ]);
      mockPasskeyServerClient.verifyAuthentication.mockResolvedValue({
        success: true,
        id: "deadbeef",
        publicKey: MOCK_SERVER_CREDENTIAL.publicKey,
        userName: MOCK_USERNAME,
      });
      mockCredentials.get.mockResolvedValue({
        id: "deadbeef",
        rawId: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        type: "public-key",
        response: {
          clientDataJSON: new Uint8Array([1]),
          authenticatorData: new Uint8Array([2]),
          signature: new Uint8Array([3]),
          userHandle: new Uint8Array([4]),
        },
        authenticatorAttachment: "platform",
        getClientExtensionResults: () => ({}),
      });

      await invokeService(authenticatePasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      const webAuthnRequest = mockCredentials.get.mock.calls[0]?.[0] as {
        publicKey?: {
          allowCredentials?: Array<{ id: ArrayBuffer }>;
        };
      };
      const credentialId = webAuthnRequest.publicKey?.allowCredentials?.[0]?.id;
      expect(credentialId).toBeInstanceOf(ArrayBuffer);
      expect(Array.from(new Uint8Array(credentialId))).toEqual([0xde, 0xad, 0xbe, 0xef]);
    });

    it("uses legacy same-device fallback when the server has no credential but local cache exists", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockPasskeyServerClient.getCredentials.mockResolvedValue([]);
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(mockPasskeyServerClient.getCredentials).toHaveBeenCalledWith({
        context: MOCK_SERVER_CONTEXT,
      });
      expect(mockPasskeyServerClient.startAuthentication).not.toHaveBeenCalled();
      expect(result.credential).toEqual(MOCK_CREDENTIAL);
      expect(result.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
    });

    it("does not overwrite the cached username when local fallback handles a recovery lookup", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockStoredUsername = "stored-local-user";
      mockPasskeyServerClient.getCredentials.mockResolvedValue([]);
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        userName: "mistyped-recovery-name",
        chainId: MOCK_CHAIN_ID,
      });

      expect(result.userName).toBe("stored-local-user");
      expect(setStoredUsername).toHaveBeenCalledWith("stored-local-user");
      expect(setStoredUsername).not.toHaveBeenCalledWith("mistyped-recovery-name");
    });

    it("preserves local auth data and falls back when the server is unavailable", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockStoredUsername = MOCK_USERNAME;
      mockAuthMode = "passkey";
      mockStoredSmartAccountAddress = MOCK_SMART_ACCOUNT_ADDRESS;
      mockPasskeyServerClient.getCredentials.mockRejectedValue(new Error("fetch failed"));
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result.credential).toEqual(MOCK_CREDENTIAL);
      expect(clearStoredCredential).not.toHaveBeenCalled();
      expect(clearStoredUsername).not.toHaveBeenCalled();
      expect(clearAuthMode).not.toHaveBeenCalled();
      expect(clearStoredSmartAccountAddress).not.toHaveBeenCalled();
    });

    it("fails closed when a recovered credential rebuilds a different stored address", async () => {
      mockStoredSmartAccountAddress = MOCK_OTHER_SMART_ACCOUNT_ADDRESS;

      await expect(
        invokeService(authenticatePasskeyService, {
          userName: MOCK_USERNAME,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("Recovered passkey did not match the expected account address");

      expect(clearStoredCredential).not.toHaveBeenCalled();
      expect(clearStoredUsername).not.toHaveBeenCalled();
      expect(clearAuthMode).not.toHaveBeenCalled();
      expect(clearStoredSmartAccountAddress).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // INTEGRATION: Username Flow
  // ==========================================================================

  describe("username flow integration", () => {
    it("new user: register stores username, enables restore", async () => {
      (createPasskey as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      // Register new user
      const registerResult = await invokeService(registerPasskeyService, {
        userName: "newuser",
        chainId: MOCK_CHAIN_ID,
      });

      expect(registerResult.userName).toBe("newuser");
      expect(setStoredUsername).toHaveBeenCalledWith("newuser");
    });

    it("existing user: authenticate uses stored credential", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        userName: "existinguser",
        chainId: MOCK_CHAIN_ID,
      });

      expect(result.userName).toBe("existinguser");
    });

    it("restore: restores session from stored credential and username", async () => {
      mockStoredUsername = "restoreduser";
      mockStoredCredential = MOCK_CREDENTIAL;

      const result = await invokeService(restoreSessionService, {
        chainId: MOCK_CHAIN_ID,
      });

      expect(result?.userName).toBe("restoreduser");
    });
  });

  // ==========================================================================
  // SERVICE RESULT TYPES
  // ==========================================================================

  describe("service result types", () => {
    it("registerPasskeyService returns complete PasskeySessionResult", async () => {
      (createPasskey as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      const result = await invokeService(registerPasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).toHaveProperty("credential");
      expect(result).toHaveProperty("smartAccountClient");
      expect(result).toHaveProperty("smartAccountAddress");
      expect(result).toHaveProperty("userName");
      expect(typeof result.smartAccountAddress).toBe("string");
      expect(result.smartAccountAddress).toMatch(/^0x/);
    });

    it("authenticatePasskeyService returns complete PasskeySessionResult", async () => {
      mockStoredCredential = MOCK_CREDENTIAL;
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).toHaveProperty("credential");
      expect(result).toHaveProperty("smartAccountClient");
      expect(result).toHaveProperty("smartAccountAddress");
      expect(result).toHaveProperty("userName");
    });

    it("restoreSessionService returns RestoreSessionResult or null", async () => {
      mockStoredUsername = MOCK_USERNAME;
      mockStoredCredential = MOCK_CREDENTIAL;

      const result = await invokeService(restoreSessionService, {
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("credential");
      expect(result).toHaveProperty("smartAccountClient");
      expect(result).toHaveProperty("smartAccountAddress");
      expect(result).toHaveProperty("userName");
    });
  });
});
