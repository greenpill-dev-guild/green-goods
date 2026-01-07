import { vi } from "vitest";
import { mockLogger } from "../utils/mocks";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.ENCRYPTION_SECRET = "test-secret-key-for-encryption-32chars!";
process.env.TELEGRAM_BOT_TOKEN = "123456:ABC-TEST-TOKEN";

// Mock only external dependencies that can't run in unit tests
vi.mock("pino", () => ({
  default: () => mockLogger,
}));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    identify: vi.fn(),
    capture: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

// Mock Telegram bot API
vi.mock("telegraf", () => ({
  Telegraf: vi.fn().mockImplementation(() => ({
    launch: vi.fn(),
    stop: vi.fn(),
    telegram: {
      sendMessage: vi.fn(),
      sendPhoto: vi.fn(),
    },
  })),
}));

// Don't mock viem, crypto, or database - use real implementations
