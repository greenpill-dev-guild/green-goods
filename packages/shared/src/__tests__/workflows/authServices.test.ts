/**
 * Auth Services Integration Tests
 *
 * Tests the async services that power the auth machine with Pimlico server:
 * - restoreSessionService: Restore session from Pimlico server using stored username
 * - registerPasskeyService: Create new passkey and store on Pimlico server
 * - authenticatePasskeyService: Login with passkey from Pimlico server
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

// Mock Pimlico passkey server client
const mockPasskeyServerClient = {
  chain: { id: 84532, name: "Base Sepolia" },
  baseUrl: "https://api.pimlico.io/v2/84532/rpc",
  startRegistration: vi.fn(),
  verifyRegistration: vi.fn(),
  getCredentials: vi.fn(),
};

vi.mock("../../config/passkeyServer", () => ({
  createPasskeyServerClient: vi.fn(() => mockPasskeyServerClient),
  createPasskey: vi.fn(),
  getPasskeyRpId: vi.fn(() => "localhost"),
  PASSKEY_RP_ID: "greengoods.app",
  PASSKEY_RP_NAME: "Green Goods",
}));

// Mocked session functions
let mockStoredUsername: string | null = null;
let mockStoredCredential: unknown = null;
let mockAuthMode: "passkey" | "wallet" | null = null;
vi.mock("../../modules/auth/session", () => ({
  getAuthMode: vi.fn(() => mockAuthMode),
  setAuthMode: vi.fn((mode: "passkey" | "wallet") => {
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
  hasStoredPasskey: vi.fn(() => false),
  getStoredRpId: vi.fn(() => "localhost"),
  setStoredRpId: vi.fn(),
  PASSKEY_STORAGE_KEY: "greengoods_passkey_credential",
  USERNAME_STORAGE_KEY: "greengoods_username",
}));

// Import after mocks
import { createPasskey } from "../../config/passkeyServer";
import { clearStoredUsername, setStoredUsername } from "../../modules/auth/session";
import {
  authenticatePasskeyService,
  claimENSService,
  registerPasskeyService,
  restoreSessionService,
} from "../../workflows/authServices";

// ============================================================================
// TEST HELPERS
// ============================================================================

const MOCK_CHAIN_ID = 84532;
const MOCK_USERNAME = "testuser";
const MOCK_SMART_ACCOUNT_ADDRESS = "0xSmartAccount123456789012345678901234567890";

const MOCK_CREDENTIAL = {
  id: "dGVzdC1jcmVkZW50aWFsLWlk", // Base64URL encoded "test-credential-id"
  publicKey: "0xTestPublicKey1234567890" as `0x${string}`,
  raw: {
    id: "dGVzdC1jcmVkZW50aWFsLWlk",
    type: "public-key",
    rawId: new Uint8Array([1, 2, 3, 4]),
  } as unknown as PublicKeyCredential,
};

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
    globalMockLocalStorage.clear();
    globalMockLocalStorage._setStore({});

    // Reset Pimlico server mock
    mockPasskeyServerClient.startRegistration.mockReset();
    mockPasskeyServerClient.verifyRegistration.mockReset();
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
