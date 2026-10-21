import { afterAll, vi } from "vitest";
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

export const mockSentryScope = {
  setContext: vi.fn(),
  setTag: vi.fn(),
};

export const mockSentry = {
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
  init: vi.fn(),
  setTag: vi.fn(),
  withScope: vi.fn((callback: (scope: typeof mockSentryScope) => void) =>
    callback(mockSentryScope)
  ),
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
process.env.VITE_RPC_URL_11155111 = "http://localhost:3009";

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

// Unit files retain per-instance isolation while executing actual SQLite semantics.
// Production and the persistence lane continue to use Bun's driver.
vi.mock("bun:sqlite", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  return {
    Database: class {
      private db = new DatabaseSync(":memory:");

      run(sql: string): void {
        this.db.exec(sql);
      }

      query(sql: string) {
        const statement = this.db.prepare(sql);
        return {
          get: (...params: Parameters<typeof statement.get>) => statement.get(...params) ?? null,
          all: (...params: Parameters<typeof statement.all>) => statement.all(...params),
          run: (...params: Parameters<typeof statement.run>) => {
            const result = statement.run(...params);
            return {
              changes: Number(result.changes),
              lastInsertRowid: Number(result.lastInsertRowid),
            };
          },
        };
      }

      close(): void {
        this.db.close();
      }
    },
  };
});

// Mock only external dependencies that can't run in unit tests
vi.mock("pino", () => ({
  default: () => mockLogger,
}));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(function PostHogMock() {
    return mockPostHog;
  }),
}));

vi.mock("@sentry/bun", () => mockSentry);

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
