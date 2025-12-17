/**
 * Auth Services Integration Tests
 *
 * Tests the async services that power the auth machine:
 * - restoreSessionService: Check for existing session on app start
 * - registerPasskeyService: Create new passkey (new user)
 * - authenticatePasskeyService: Login with existing passkey (returning user)
 * - claimENSService: Claim ENS subdomain
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
  getChain: vi.fn(() => ({ id: 84532, name: "Base Sepolia" })),
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

// Mock passkeyServer
vi.mock("../../config/passkeyServer", () => ({
  createPasskeyCredential: vi.fn(),
}));

// Mocked session functions
let mockStoredUsername: string | null = null;
vi.mock("../../modules/auth/session", () => ({
  getStoredUsername: vi.fn(() => mockStoredUsername),
  setStoredUsername: vi.fn((u: string) => {
    mockStoredUsername = u;
  }),
  clearStoredUsername: vi.fn(() => {
    mockStoredUsername = null;
  }),
  hasStoredPasskey: vi.fn(() => false),
  PASSKEY_STORAGE_KEY: "greengoods_passkey_credential",
}));

// Import after mocks
import { createWebAuthnCredential } from "viem/account-abstraction";
import {
  restoreSessionService,
  registerPasskeyService,
  authenticatePasskeyService,
  claimENSService,
} from "../../workflows/authServices";
import {
  setStoredUsername,
  clearStoredUsername,
  PASSKEY_STORAGE_KEY,
} from "../../modules/auth/session";

// ============================================================================
// TEST HELPERS
// ============================================================================

const MOCK_CHAIN_ID = 84532;
const MOCK_USERNAME = "testuser";
const MOCK_SMART_ACCOUNT_ADDRESS = "0xSmartAccount123456789012345678901234567890";

const MOCK_CREDENTIAL = {
  id: "dGVzdC1jcmVkZW50aWFsLWlk", // Base64URL encoded "test-credential-id"
  publicKey: "0xTestPublicKey1234567890",
  raw: {
    id: "dGVzdC1jcmVkZW50aWFsLWlk",
    type: "public-key",
    rawId: new Uint8Array([1, 2, 3, 4]),
  },
};

const MOCK_SERIALIZED_CREDENTIAL = JSON.stringify({
  id: MOCK_CREDENTIAL.id,
  publicKey: MOCK_CREDENTIAL.publicKey,
  raw: MOCK_CREDENTIAL.raw,
});

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

describe("workflows/authServices", () => {
  let mockCredentials: {
    create: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoredUsername = null;
    globalMockLocalStorage.clear();
    globalMockLocalStorage._setStore({});

    // Setup navigator.credentials mock
    mockCredentials = {
      create: vi.fn(),
      get: vi.fn(),
    };
    // Mock on both global.navigator and window.navigator
    Object.defineProperty(global.navigator, "credentials", {
      value: mockCredentials,
      writable: true,
      configurable: true,
    });
    // Ensure window.navigator.credentials also points to the same mock
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
  // RESTORE SESSION SERVICE
  // ==========================================================================

  describe("restoreSessionService", () => {
    it("returns null when no stored username or credential", async () => {
      mockStoredUsername = null;
      globalMockLocalStorage.getItem.mockReturnValue(null);

      const result = await invokeService(restoreSessionService, {
        passkeyClient: null,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).toBeNull();
    });

    it("restores session from localStorage credential", async () => {
      mockStoredUsername = MOCK_USERNAME;
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);

      const result = await invokeService(restoreSessionService, {
        passkeyClient: null,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).not.toBeNull();
      expect(result?.credential).toBeDefined();
      expect(result?.smartAccountClient).toBeDefined();
      expect(result?.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
      expect(result?.userName).toBe(MOCK_USERNAME);
    });

    it("clears invalid credential and returns null", async () => {
      mockStoredUsername = null;
      globalMockLocalStorage.getItem.mockReturnValue("invalid-json-{{{");

      const result = await invokeService(restoreSessionService, {
        passkeyClient: null,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).toBeNull();
      expect(globalMockLocalStorage.removeItem).toHaveBeenCalledWith(PASSKEY_STORAGE_KEY);
      expect(clearStoredUsername).toHaveBeenCalled();
    });

    it("uses fallback username when not stored", async () => {
      mockStoredUsername = null;
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);

      const result = await invokeService(restoreSessionService, {
        passkeyClient: null,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result?.userName).toBe("user"); // Fallback
    });
  });

  // ==========================================================================
  // REGISTER PASSKEY SERVICE
  // ==========================================================================

  describe("registerPasskeyService", () => {
    it("throws when username is missing", async () => {
      await expect(
        invokeService(registerPasskeyService, {
          passkeyClient: null,
          userName: null,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("Username is required for registration");
    });

    it("creates credential and persists to localStorage", async () => {
      (createWebAuthnCredential as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      const result = await invokeService(registerPasskeyService, {
        passkeyClient: null,
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(createWebAuthnCredential).toHaveBeenCalledWith({
        name: "Green Goods Wallet",
        createFn: expect.any(Function),
      });
      expect(globalMockLocalStorage.setItem).toHaveBeenCalledWith(
        PASSKEY_STORAGE_KEY,
        expect.any(String)
      );
      expect(setStoredUsername).toHaveBeenCalledWith(MOCK_USERNAME);
      expect(result.credential).toEqual(MOCK_CREDENTIAL);
      expect(result.userName).toBe(MOCK_USERNAME);
      expect(result.smartAccountAddress).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
    });

    it("builds smart account from credential", async () => {
      (createWebAuthnCredential as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      const result = await invokeService(registerPasskeyService, {
        passkeyClient: null,
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result.smartAccountClient).toBeDefined();
      expect(result.smartAccountClient.account.address).toBe(MOCK_SMART_ACCOUNT_ADDRESS);
    });

    it("persists credential in correct format", async () => {
      (createWebAuthnCredential as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      await invokeService(registerPasskeyService, {
        passkeyClient: null,
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      // Verify localStorage was called with serialized credential
      const calls = globalMockLocalStorage.setItem.mock.calls;
      const storedValue = calls.find(
        (call: [string, string]) => call[0] === PASSKEY_STORAGE_KEY
      )?.[1];
      expect(storedValue).toBeDefined();

      const parsed = JSON.parse(storedValue!);
      expect(parsed.id).toBe(MOCK_CREDENTIAL.id);
      expect(parsed.publicKey).toBe(MOCK_CREDENTIAL.publicKey);
    });
  });

  // ==========================================================================
  // AUTHENTICATE PASSKEY SERVICE
  // ==========================================================================

  describe("authenticatePasskeyService", () => {
    it("throws when no stored credential exists", async () => {
      globalMockLocalStorage.getItem.mockReturnValue(null);

      await expect(
        invokeService(authenticatePasskeyService, {
          passkeyClient: null,
          userName: MOCK_USERNAME,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("No passkey found. Please create a new account.");
    });

    it("authenticates with stored credential", async () => {
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        passkeyClient: null,
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result.credential).toBeDefined();
      expect(result.smartAccountClient).toBeDefined();
      expect(result.userName).toBe(MOCK_USERNAME);
    });

    it("prompts WebAuthn authentication", async () => {
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      await invokeService(authenticatePasskeyService, {
        passkeyClient: null,
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(mockCredentials.get).toHaveBeenCalledWith({
        publicKey: expect.objectContaining({
          rpId: "localhost",
          userVerification: "required",
          timeout: 60000,
        }),
      });
    });

    it("throws when authentication is cancelled", async () => {
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);
      mockCredentials.get.mockResolvedValue(null); // User cancelled

      await expect(
        invokeService(authenticatePasskeyService, {
          passkeyClient: null,
          userName: MOCK_USERNAME,
          chainId: MOCK_CHAIN_ID,
        })
      ).rejects.toThrow("Passkey authentication was cancelled");
    });

    it("stores username after successful auth", async () => {
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      await invokeService(authenticatePasskeyService, {
        passkeyClient: null,
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(setStoredUsername).toHaveBeenCalledWith(MOCK_USERNAME);
    });

    it("uses stored username as fallback", async () => {
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });
      mockStoredUsername = "stored-user";

      const result = await invokeService(authenticatePasskeyService, {
        passkeyClient: null,
        userName: null, // No username provided
        chainId: MOCK_CHAIN_ID,
      });

      expect(result.userName).toBe("stored-user");
    });

    it("handles base64url credential ID decoding", async () => {
      // Test with a valid base64url encoded ID
      const credentialWithBase64 = JSON.stringify({
        id: "SGVsbG8", // "Hello" in base64url
        publicKey: "0xTestKey",
        raw: {},
      });
      globalMockLocalStorage.getItem.mockReturnValue(credentialWithBase64);
      mockCredentials.get.mockResolvedValue({
        id: "SGVsbG8",
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        passkeyClient: null,
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      expect(result).toBeDefined();
      // Verify credentials.get was called with proper allowCredentials
      expect(mockCredentials.get).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.objectContaining({
            allowCredentials: expect.arrayContaining([
              expect.objectContaining({ type: "public-key" }),
            ]),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // CLAIM ENS SERVICE
  // ==========================================================================

  describe("claimENSService", () => {
    it("throws when smart account client is missing", async () => {
      await expect(
        invokeService(claimENSService, {
          smartAccountClient: null,
          name: "test.greengoods.eth",
        })
      ).rejects.toThrow("Smart account client required for ENS claim");
    });
  });

  // ==========================================================================
  // INTEGRATION: Service Result Types
  // ==========================================================================

  describe("service result types", () => {
    it("registerPasskeyService returns complete PasskeySessionResult", async () => {
      (createWebAuthnCredential as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CREDENTIAL);

      const result = await invokeService(registerPasskeyService, {
        passkeyClient: null,
        userName: MOCK_USERNAME,
        chainId: MOCK_CHAIN_ID,
      });

      // Verify all required fields are present
      expect(result).toHaveProperty("credential");
      expect(result).toHaveProperty("smartAccountClient");
      expect(result).toHaveProperty("smartAccountAddress");
      expect(result).toHaveProperty("userName");

      // Verify types
      expect(typeof result.credential.id).toBe("string");
      expect(typeof result.smartAccountAddress).toBe("string");
      expect(result.smartAccountAddress).toMatch(/^0x/);
    });

    it("authenticatePasskeyService returns complete PasskeySessionResult", async () => {
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);
      mockCredentials.get.mockResolvedValue({
        id: MOCK_CREDENTIAL.id,
        type: "public-key",
      });

      const result = await invokeService(authenticatePasskeyService, {
        passkeyClient: null,
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
      globalMockLocalStorage.getItem.mockReturnValue(MOCK_SERIALIZED_CREDENTIAL);

      const result = await invokeService(restoreSessionService, {
        passkeyClient: null,
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
