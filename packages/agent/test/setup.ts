import { vi } from 'vitest';

// Only mock external services that can't run in tests
vi.mock('posthog-node', () => ({
  PostHog: class {
    identify = vi.fn();
    capture = vi.fn();
  },
}));

// For blockchain tests, use a test provider
process.env.VITE_RPC_URL_84532 = 'http://localhost:8545'; // Local test node
process.env.ENCRYPTION_SECRET = 'test-secret-key-for-encryption-32chars!';
process.env.TELEGRAM_BOT_TOKEN = 'test-token';

// Mock only truly external APIs
vi.mock('@storacha/client', () => ({
  Client: class {
    uploadFile = vi.fn().mockResolvedValue({ cid: 'test-cid' });
  },
}));