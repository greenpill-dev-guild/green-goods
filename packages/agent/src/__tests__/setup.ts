import { afterAll, beforeAll, vi } from "vitest";
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
    ancestorOrigins: {} as DOMStringList,
    assign: vi.fn(),
    reload: vi.fn(),
    replace: vi.fn(),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  navigator: {
    userAgent: "node-test",
  },
} as unknown as Window & typeof globalThis;

globalThis.localStorage = mockLocalStorage as unknown as Storage;

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
  VITE_RPC_URL_11155111: process.env.VITE_RPC_URL_11155111,
  NODE_ENV: process.env.NODE_ENV,
};

// Set test environment variables IMMEDIATELY (before any module imports)
process.env.NODE_ENV = "test";
process.env.ENCRYPTION_SECRET = "test-secret-key-for-encryption-32chars!";
process.env.TELEGRAM_BOT_TOKEN = "123456:ABC-TEST-TOKEN";
process.env.VITE_RPC_URL_11155111 = "http://localhost:8545";

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
  private transactionSnapshot: Map<string, Map<string, Record<string, unknown>>> | null = null;
  private createTableRegex = /CREATE TABLE IF NOT EXISTS (\w+)/i;
  private insertRegex = /INSERT(?: OR REPLACE| OR IGNORE)? INTO (\w+)/i;
  private selectRegex = /SELECT (?:\*|id) FROM (\w+)(?:\s+WHERE|\s+ORDER|\s+LIMIT|\s*$)/i;
  private updateRegex = /UPDATE\s+(\w+)\s+SET/i;
  private deleteRegex = /DELETE FROM (\w+) WHERE/i;
  private createIndexRegex = /CREATE INDEX/i;

  constructor(_path?: string) {
    // Path is ignored for in-memory mock
    this.tables = new Map();
  }

  run(sql: string): void {
    const normalized = sql.trim().toUpperCase();
    if (normalized === "BEGIN") {
      this.transactionSnapshot = this.cloneTables();
      return;
    }
    if (normalized === "COMMIT") {
      this.transactionSnapshot = null;
      return;
    }
    if (normalized === "ROLLBACK") {
      if (this.transactionSnapshot) {
        this.tables = this.transactionSnapshot;
        this.transactionSnapshot = null;
      }
      return;
    }

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
        // SELECT COUNT(*) FROM chat_messages WHERE status = 'new' AND postedAt < ?
        if (/SELECT COUNT\(\*\).*FROM chat_messages/i.test(sql)) {
          const table = self.tables.get("chat_messages");
          if (!table) return { count: 0 };
          const cutoff = params[0] as number;
          const count = Array.from(table.values()).filter((row) => {
            if (/status\s*=\s*'processing'/i.test(sql)) {
              return row.status === "processing" && (row.updatedAt as number) < cutoff;
            }
            return row.status === "new" && (row.postedAt as number) < cutoff;
          }).length;
          return { count };
        }

        // SELECT * FROM chat_message_attachments WHERE chatMessageId = ? AND ordinal = ?
        if (/FROM chat_message_attachments/i.test(sql)) {
          const table = self.tables.get("chat_message_attachments");
          if (!table) return null;
          const key = `${params[0]}:${params[1]}`;
          return table.get(key) ?? null;
        }

        // Handle SELECT
        const selectMatch = sql.match(self.selectRegex);
        if (selectMatch) {
          const tableName = selectMatch[1];
          const table = self.tables.get(tableName);
          if (!table) return null;

          // SELECT * FROM chat_messages WHERE id = ?
          if (tableName === "chat_messages") {
            const key = String(params[0]);
            return table.get(key) ?? null;
          }

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

          if (tableName === "chat_messages") {
            // Reverse-engineer the dynamic WHERE clause from the SQL so the
            // mock follows the real query even if clause order changes.
            let rows = Array.from(table.values());
            const whereMatch = sql.match(/\sWHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|\s*$)/i);
            const conditions = whereMatch?.[1]?.split(/\s+AND\s+/i) ?? [];
            for (const condition of conditions) {
              const value = condition.includes("?") ? params.shift() : undefined;
              if (/^status\s*=\s*\?/i.test(condition)) {
                rows = rows.filter((row) => row.status === value);
              } else if (/^chatId\s*=\s*\?/i.test(condition)) {
                rows = rows.filter((row) => row.chatId === value);
              } else if (/^threadId\s*=\s*\?/i.test(condition)) {
                rows = rows.filter((row) => row.threadId === value);
              } else if (/^inferredType\s*=\s*\?/i.test(condition)) {
                rows = rows.filter((row) => row.inferredType === value);
              } else if (/^postedAt\s*>=\s*\?/i.test(condition)) {
                rows = rows.filter((row) => (row.postedAt as number) >= (value as number));
              } else if (/^status\s+IN\s+\('triaged',\s*'rejected'\)/i.test(condition)) {
                rows = rows.filter((row) => row.status === "triaged" || row.status === "rejected");
              } else if (/^postedAt\s*<\s*\?/i.test(condition)) {
                rows = rows.filter((row) => (row.postedAt as number) < (value as number));
              }
            }
            const limit = params.shift() as number | undefined;
            rows = rows.sort((a, b) => (a.postedAt as number) - (b.postedAt as number));
            if (typeof limit === "number") rows = rows.slice(0, limit);
            return rows;
          }

          if (tableName === "chat_message_attachments") {
            // SELECT * FROM chat_message_attachments WHERE chatMessageId IN (?, ?, …)
            const messageIds = new Set(params.map((p) => String(p)));
            return Array.from(table.values()).filter((row) =>
              messageIds.has(String(row.chatMessageId))
            );
          }

          // Filter by gardenAddress if present
          if (params.length === 1) {
            const gardenAddress = String(params[0]);
            return Array.from(table.values()).filter((row) => row.gardenAddress === gardenAddress);
          }
          return Array.from(table.values());
        }
        return [];
      },

      run(...params: unknown[]): { changes: number; lastInsertRowid: number } | void {
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
            users: 8,
            sessions: 5,
            pending_works: 7,
            idempotency_keys: 9,
            chat_messages: 12,
            chat_message_attachments: 11,
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
              locale: params[6],
              createdAt: params[7],
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
          } else if (tableName === "idempotency_keys") {
            if (params.length !== EXPECTED_PARAMS.idempotency_keys) {
              throw new Error(
                `Mock DB: Expected ${EXPECTED_PARAMS.idempotency_keys} params for idempotency_keys, got ${params.length}`
              );
            }
            key = String(params[0]);
            if (table.has(key)) {
              if (/INSERT OR IGNORE/i.test(sql)) {
                return { changes: 0, lastInsertRowid: 0 };
              }
              throw new Error("UNIQUE constraint failed: idempotency_keys.key");
            }
            row = {
              key: params[0],
              handler: params[1],
              platform: params[2],
              platformId: params[3],
              messageId: params[4],
              status: params[5],
              response: params[6],
              createdAt: params[7],
              updatedAt: params[8],
            };
          } else if (tableName === "chat_messages") {
            if (params.length !== EXPECTED_PARAMS.chat_messages) {
              throw new Error(
                `Mock DB: Expected ${EXPECTED_PARAMS.chat_messages} params for chat_messages, got ${params.length}`
              );
            }
            key = String(params[0]);
            if (table.has(key)) {
              throw new Error("UNIQUE constraint failed: chat_messages.id");
            }
            row = {
              id: params[0],
              platform: params[1],
              chatId: params[2],
              threadId: params[3],
              messageId: params[4],
              senderPlatformId: params[5],
              senderDisplayName: params[6],
              text: params[7],
              replyToMessageId: params[8],
              inferredType: params[9],
              status: "new",
              postedAt: params[10],
              updatedAt: params[11],
            };
          } else if (tableName === "chat_message_attachments") {
            if (params.length !== EXPECTED_PARAMS.chat_message_attachments) {
              throw new Error(
                `Mock DB: Expected ${EXPECTED_PARAMS.chat_message_attachments} params for chat_message_attachments, got ${params.length}`
              );
            }
            key = String(params[0]);
            if (table.has(key)) {
              throw new Error("UNIQUE constraint failed: chat_message_attachments.id");
            }
            row = {
              id: params[0],
              chatMessageId: params[1],
              ordinal: params[2],
              kind: params[3],
              telegramFileId: params[4],
              mimeType: params[5],
              fileSize: params[6],
              duration: params[7],
              width: params[8],
              height: params[9],
              createdAt: params[10],
            };
          } else {
            key = String(params[0]);
            row = { id: params[0] };
          }

          table.set(key, row);
          return { changes: 1, lastInsertRowid: table.size };
        }

        // Handle UPDATE
        const updateMatch = sql.match(self.updateRegex);
        if (updateMatch) {
          const tableName = updateMatch[1];
          const table = self.tables.get(tableName);
          if (!table) return;

          if (tableName === "idempotency_keys") {
            const key = String(params[params.length - 1]);
            const existingRow = table.get(key);
            if (existingRow) {
              existingRow.status = params[0];
              existingRow.response = params[1];
              existingRow.updatedAt = params[2];
              table.set(key, existingRow);
            }
          } else if (tableName === "chat_messages") {
            // UPDATE chat_messages SET status = ?, updatedAt = ? WHERE id = ?
            if (/status\s*=\s*'processing'/i.test(sql)) {
              const now = params[0];
              const id = String(params[1]);
              const staleBefore = params[2] as number;
              const existingRow = table.get(id);
              if (
                existingRow &&
                (existingRow.status === "new" ||
                  (existingRow.status === "processing" &&
                    (existingRow.updatedAt as number) < staleBefore))
              ) {
                existingRow.status = "processing";
                existingRow.updatedAt = now;
                table.set(id, existingRow);
                return { changes: 1, lastInsertRowid: 0 };
              }
              return { changes: 0, lastInsertRowid: 0 };
            }
            const id = params[params.length - 1];
            const key = String(id);
            const existingRow = table.get(key);
            if (existingRow) {
              existingRow.status = params[0];
              existingRow.updatedAt = params[1];
              table.set(key, existingRow);
              return { changes: 1, lastInsertRowid: 0 };
            }
            return { changes: 0, lastInsertRowid: 0 };
          } else {
            // Other tables: last two params are platform, platformId for WHERE clause
            const platform = params[params.length - 2];
            const platformId = params[params.length - 1];
            const key = `${platform}:${platformId}`;

            const existingRow = table.get(key);
            if (existingRow) {
              const setFields = params.slice(0, -2);
              const assignments = Array.from(sql.matchAll(/(\w+)\s*=\s*\?/g)).map(
                (match) => match[1]
              );
              assignments.forEach((field, index) => {
                existingRow[field] = setFields[index];
              });
              table.set(key, existingRow);
            }
          }
          return;
        }

        // Handle DELETE
        const deleteMatch = sql.match(self.deleteRegex);
        if (deleteMatch) {
          const tableName = deleteMatch[1];
          const table = self.tables.get(tableName);
          if (!table) return { changes: 0, lastInsertRowid: 0 };

          // DELETE FROM chat_messages WHERE status IN ('triaged', 'rejected') AND postedAt < ?
          if (
            tableName === "chat_messages" &&
            /status\s+IN\s+\('triaged',\s*'rejected'\).*postedAt\s*<\s*\?/i.test(sql)
          ) {
            const cutoff = params[0] as number;
            let pruned = 0;
            for (const [key, row] of table.entries()) {
              if (
                (row.status === "triaged" || row.status === "rejected") &&
                (row.postedAt as number) < cutoff
              ) {
                table.delete(key);
                pruned += 1;
                // Cascade delete attachments
                const attachments = self.tables.get("chat_message_attachments");
                if (attachments) {
                  for (const [attachKey, attachRow] of attachments.entries()) {
                    if (attachRow.chatMessageId === row.id) {
                      attachments.delete(attachKey);
                    }
                  }
                }
              }
            }
            return { changes: pruned, lastInsertRowid: 0 };
          }

          const key = params.length >= 2 ? `${params[0]}:${params[1]}` : String(params[0]);
          table.delete(key);
        }
      },
    };
  }

  close(): void {
    this.tables.clear();
  }

  private cloneTables(): Map<string, Map<string, Record<string, unknown>>> {
    const clone = new Map<string, Map<string, Record<string, unknown>>>();
    for (const [tableName, table] of this.tables.entries()) {
      clone.set(
        tableName,
        new Map(Array.from(table.entries()).map(([key, value]) => [key, { ...value }]))
      );
    }
    return clone;
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
  getDefaultChain: () => ({ id: 11155111, name: "Sepolia" }),
  getNetworkConfig: (chainId: number, alchemyKey: string) => ({
    chainId,
    rpcUrl: `https://example.invalid/${chainId}/${alchemyKey}`,
  }),
  submitApprovalBot: vi.fn().mockResolvedValue({ hash: "0x" + "0".repeat(64) }),
  submitWorkBot: vi.fn().mockResolvedValue({ hash: "0x" + "0".repeat(64) }),

  // Config constants
  DEFAULT_CHAIN_ID: 11155111,
  SUPPORTED_CHAINS: [{ id: 11155111, name: "Sepolia" }],

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
  PostHog: vi.fn().mockImplementation(function PostHogMock() {
    return mockPostHog;
  }),
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
