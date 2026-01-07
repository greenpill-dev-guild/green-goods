import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    env: {
      ENCRYPTION_SECRET: 'test-secret-key-for-encryption-32chars!',
      TELEGRAM_BOT_TOKEN: 'test-token',
      VITE_RPC_URL_84532: 'http://localhost:8545'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@green-goods/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});