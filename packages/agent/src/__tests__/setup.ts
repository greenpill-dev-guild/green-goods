import { vi, beforeAll, afterAll } from "vitest";
import { mockLogger } from "./utils/mocks";

// ============================================================================
// Browser Globals Mock (MUST be before any imports that use @green-goods/shared)
// ============================================================================
// The shared package has browser-only code that references `window` and `localStorage`.
// We mock these globally for Node.js test environment.

const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};

// @ts-expect-error - Mocking browser globals in Node environment
globalThis.window = {
  localStorage: mockLocalStorage,
  location: {
    href: "http://localhost:3000",
    origin: "http://localhost:3000",
    hostname: "localhost",
    pathname: "/",
    search: "",
    hash: "",
    protocol: "http:",
    host: "localhost:3000",
    port: "3000",
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  navigator: {
    userAgent: "node-test",
  },
};

// @ts-expect-error - Mocking browser globals in Node environment
globalThis.localStorage = mockLocalStorage;

// ============================================================================
// Injectable Timestamp for Deterministic Tests
// ============================================================================

let testTimestamp: number | null = null;

/**
 * Set a fixed timestamp for tests. Pass null to reset to Date.now().
 */
export function setTestTimestamp(ts: number | null): void {
  testTimestamp = ts;
}

/**
 * Get the test timestamp or current time if not set.
 */
export function getTestTimestamp(): number {
  return testTimestamp ?? Date.now();
}

// ============================================================================
// Exported Mock Instances for PostHog and Telegram
// ============================================================================

/**
 * Exported PostHog mock instance for per-test customization.
 */
export const mockPostHog = {
  identify: vi.fn(),
  capture: vi.fn(),
  shutdown: vi.fn(),
};

/**
 * Exported Telegram mock instance for per-test customization.
 */
export const mockTelegram = {
  launch: vi.fn(),
  stop: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
  sendPhoto: vi.fn().mockResolvedValue({ message_id: 124 }),
};

// ============================================================================
// Mock Failure Simulation Helpers
// ============================================================================

/**
 * Simulate a Telegram API error for the next sendMessage call.
 */
export function simulateTelegramError(error = new Error("Telegram API error")): void {
  mockTelegram.sendMessage.mockRejectedValueOnce(error);
}

/**
 * Simulate a PostHog API error for the next capture call.
 */
export function simulatePostHogError(error = new Error("PostHog API error")): void {
  mockPostHog.capture.mockRejectedValueOnce(error);
}

/**
 * Reset all mock instances to their initial state.
 */
export function resetMocks(): void {
  mockPostHog.identify.mockClear();
  mockPostHog.capture.mockClear();
  mockPostHog.shutdown.mockClear();
  mockTelegram.launch.mockClear();
  mockTelegram.stop.mockClear();
  mockTelegram.sendMessage.mockClear();
  mockTelegram.sendPhoto.mockClear();
}

// ============================================================================
// Environment Setup
// ============================================================================

// IMPORTANT: Set environment variables at MODULE LEVEL, not in beforeAll.
// This ensures they're available when modules are first imported.
// The crypto.ts module reads ENCRYPTION_SECRET during initialization.

// Store original env values
const originalEnv = {
  ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  VITE_RPC_URL_84532: process.env.VITE_RPC_URL_84532,
  NODE_ENV: process.env.NODE_ENV,
};

// Set test environment variables IMMEDIATELY (before any module imports)
process.env.NODE_ENV = "test";
process.env.ENCRYPTION_SECRET = "test-secret-key-for-encryption-32chars!";
process.env.TELEGRAM_BOT_TOKEN = "123456:ABC-TEST-TOKEN";
process.env.VITE_RPC_URL_84532 = "http://localhost:8545";

afterAll(() => {
  // Restore original env values
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

/**
 * In-memory SQLite mock for bun:sqlite
 *
 * This provides a simple key-value store that mimics SQLite operations
 * for unit testing. For integration tests, use bun test directly.
 */
class InMemoryDatabase {
  private tables: Map<string, Map<string, Record<string, unknown>>> = new Map();
  private createTableRegex = /CREATE TABLE IF NOT EXISTS (\w+)/i;
  private insertRegex = /INSERT(?: OR REPLACE)? INTO (\w+)/i;
  private selectRegex = /SELECT \* FROM (\w+) WHERE/i;
  private updateRegex = /UPDATE (\w+) SET/i;
  private deleteRegex = /DELETE FROM (\w+) WHERE/i;
  private createIndexRegex = /CREATE INDEX/i;

  constructor(_path?: string) {
    // Path is ignored for in-memory mock
    this.tables = new Map();
  }

  run(sql: string): void {
    // Handle CREATE TABLE
    const createMatch = sql.match(this.createTableRegex);
    if (createMatch) {
      const tableName = createMatch[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, new Map());
      }
    }
    // Ignore CREATE INDEX
  }

  query(sql: string) {
    const self = this;

    return {
      get(...params: unknown[]): unknown {
        // Handle SELECT
        const selectMatch = sql.match(self.selectRegex);
        if (selectMatch) {
          const tableName = selectMatch[1];
          const table = self.tables.get(tableName);
          if (!table) return null;

          // Simple key lookup based on first two params (platform, platformId) or single param (id)
          const key = params.length >= 2 ? `${params[0]}:${params[1]}` : String(params[0]);
          const row = table.get(key);
          return row ?? null;
        }
        return null;
      },

      all(...params: unknown[]): unknown[] {
        const selectMatch = sql.match(self.selectRegex);
        if (selectMatch) {
          const tableName = selectMatch[1];
          const table = self.tables.get(tableName);
          if (!table) return [];

          // Filter by gardenAddress if present
          if (params.length === 1) {
            const gardenAddress = String(params[0]);
            return Array.from(table.values()).filter((row) => row.gardenAddress === gardenAddress);
          }
          return Array.from(table.values());
        }
        return [];
      },

      run(...params: unknown[]): void {
        // Handle INSERT
        const insertMatch = sql.match(self.insertRegex);
        if (insertMatch) {
          const tableName = insertMatch[1];
          let table = self.tables.get(tableName);
          if (!table) {
            table = new Map();
            self.tables.set(tableName, table);
          }

          // Expected params count for validation
          const EXPECTED_PARAMS: Record<string, number> = {
            users: 7,
            sessions: 5,
            pending_works: 7,
          };

          // Determine key based on table
          let key: string;
          let row: Record<string, unknown>;

          if (tableName === "users") {
            if (params.length !== EXPECTED_PARAMS.users) {
              throw new Error(
                `Mock DB: Expected ${EXPECTED_PARAMS.users} params for users, got ${params.length}`
              );
            }
            key = `${params[0]}:${params[1]}`;
            row = {
              platform: params[0],
              platformId: params[1],
              privateKey: params[2],
              address: params[3],
              currentGarden: params[4],
              role: params[5],
              createdAt: params[6],
            };
          } else if (tableName === "sessions") {
            if (params.length !== EXPECTED_PARAMS.sessions) {
              throw new Error(
                `Mock DB: Expected ${EXPECTED_PARAMS.sessions} params for sessions, got ${params.length}`
              );
            }
            key = `${params[0]}:${params[1]}`;
            row = {
              platform: params[0],
              platformId: params[1],
              step: params[2],
              draft: params[3],
              updatedAt: params[4],
            };
          } else if (tableName === "pending_works") {
            if (params.length !== EXPECTED_PARAMS.pending_works) {
              throw new Error(
                `Mock DB: Expected ${EXPECTED_PARAMS.pending_works} params for pending_works, got ${params.length}`
              );
            }
            key = String(params[0]);
            row = {
              id: params[0],
              actionUID: params[1],
              gardenerAddress: params[2],
              gardenerPlatform: params[3],
              gardenerPlatformId: params[4],
              gardenAddress: params[5],
              data: params[6],
              createdAt: getTestTimestamp(),
            };
          } else {
            key = String(params[0]);
            row = { id: params[0] };
          }

          table.set(key, row);
          return;
        }

        // Handle UPDATE
        const updateMatch = sql.match(self.updateRegex);
        if (updateMatch) {
          const tableName = updateMatch[1];
          const table = self.tables.get(tableName);
          if (!table) return;

          // Last two params are always platform, platformId for WHERE clause
          const platform = params[params.length - 2];
          const platformId = params[params.length - 1];
          const key = `${platform}:${platformId}`;

          const existingRow = table.get(key);
          if (existingRow) {
            // Update fields based on SET clause
            const setFields = params.slice(0, -2);
            if (sql.includes("currentGarden = ?") && sql.includes("role = ?")) {
              existingRow.currentGarden = setFields[0];
              existingRow.role = setFields[1];
            } else if (sql.includes("currentGarden = ?")) {
              existingRow.currentGarden = setFields[0];
            } else if (sql.includes("role = ?")) {
              existingRow.role = setFields[0];
            } else if (sql.includes("privateKey = ?")) {
              existingRow.privateKey = setFields[0];
            }
            table.set(key, existingRow);
          }
          return;
        }

        // Handle DELETE
        const deleteMatch = sql.match(self.deleteRegex);
        if (deleteMatch) {
          const tableName = deleteMatch[1];
          const table = self.tables.get(tableName);
          if (!table) return;

          const key = params.length >= 2 ? `${params[0]}:${params[1]}` : String(params[0]);
          table.delete(key);
        }
      },
    };
  }

  close(): void {
    this.tables.clear();
  }
}

// Mock bun:sqlite with in-memory implementation
vi.mock("bun:sqlite", () => ({
  Database: InMemoryDatabase,
}));

// Mock @green-goods/shared completely (do NOT use importActual - it triggers browser library initialization)
// The agent only uses a small subset of the shared package.
vi.mock("@green-goods/shared", () => ({
  // Blockchain functions used by agent
  getDefaultChain: () => ({ id: 84532, name: "Base Sepolia" }),
  submitApprovalBot: vi.fn().mockResolvedValue({ hash: "0x" + "0".repeat(64) }),
  submitWorkBot: vi.fn().mockResolvedValue({ hash: "0x" + "0".repeat(64) }),

  // Config constants
  DEFAULT_CHAIN_ID: 84532,
  SUPPORTED_CHAINS: [{ id: 84532, name: "Base Sepolia" }],

  // Type guards and utilities
  isAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
  getAddress: (address: string) => address.toLowerCase(),
  zeroAddress: "0x0000000000000000000000000000000000000000",

  // Hypercerts constants (for work submission)
  TOTAL_UNITS: 100000000n,
  TransferRestrictions: {
    AllowAll: 0,
    DisallowAll: 1,
    FromCreatorOnly: 2,
  },

  // Action domains
  ACTION_DOMAINS: ["biodiversity", "water", "soil", "carbon", "air", "community"],

  // Error utilities
  parseContractError: vi.fn(() => ({
    raw: "0x00000000",
    name: "UnknownError",
    message: "Unknown error",
    isKnown: false,
    recoverable: true,
    suggestedAction: "retry",
  })),
  formatErrorForToast: vi.fn(() => ({ title: "Error", message: "Unknown error" })),
  parseAndFormatError: vi.fn(() => ({
    title: "Error",
    message: "Unknown error",
    parsed: { name: "UnknownError", isKnown: false },
  })),

  // Logger (noop for tests)
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock only external dependencies that can't run in unit tests
vi.mock("pino", () => ({
  default: () => mockLogger,
}));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => mockPostHog),
}));

// Mock Telegram bot API
vi.mock("telegraf", () => ({
  Telegraf: vi.fn().mockImplementation(() => ({
    launch: mockTelegram.launch,
    stop: mockTelegram.stop,
    telegram: {
      sendMessage: mockTelegram.sendMessage,
      sendPhoto: mockTelegram.sendPhoto,
    },
  })),
}));

// Mock Storacha storage client
vi.mock("@storacha/client", () => ({
  Client: vi.fn().mockImplementation(() => ({
    uploadFile: vi.fn().mockResolvedValue({ cid: "test-cid" }),
  })),
}));
