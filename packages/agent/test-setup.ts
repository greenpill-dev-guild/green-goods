import { mock } from "bun:test";

// Set required environment variables for tests
process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32-chars!!';
process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-bot-token';
process.env.VITE_RPC_URL_84532 = 'http://localhost:8545';
process.env.NODE_ENV = 'test';

// Mock pino globally
mock.module("pino", () => {
  const createLogger = () => ({
    debug: () => {},
    error: () => {},
    info: () => {},
    warn: () => {},
    child: () => createLogger(),
  });
  return {
    default: createLogger,
  };
});

// Mock posthog-node
mock.module("posthog-node", () => ({
  PostHog: class {
    identify() {}
    capture() {}
  },
}));

// Mock viem
mock.module("viem", () => ({
  createPublicClient: () => ({
    readContract: async () => {},
    simulateContract: async () => ({ request: {} }),
  }),
  createWalletClient: () => ({
    writeContract: async () => "0x" + "0".repeat(64),
  }),
  http: () => ({}),
  privateKeyToAccount: () => ({
    address: "0x" + "0".repeat(40),
  }),
  formatUnits: (value: bigint, decimals: number) => value.toString(),
  parseUnits: (value: string, decimals: number) => BigInt(value),
  getContract: () => ({
    read: {},
    write: {},
    address: "0x" + "0".repeat(40),
  }),
}));

// Mock viem/chains
mock.module("viem/chains", () => ({
  baseSepolia: {
    id: 84532,
    name: "Base Sepolia",
  },
}));

// Mock multiformats/basics
mock.module("multiformats/basics", () => ({
  bases: {
    base58btc: {
      encode: () => "",
      decode: () => new Uint8Array(),
    },
  },
}));

// Mock @green-goods/shared
mock.module("@green-goods/shared", () => ({
  getDefaultChain: () => ({
    id: 84532,
    name: "Base Sepolia",
  }),
  submitApprovalBot: async () => ({ hash: "0x" + "0".repeat(64) }),
  submitWorkBot: async () => ({ hash: "0x" + "0".repeat(64) }),
}));

// Mock react
mock.module("react", () => ({
  useState: () => [{}, () => {}],
  useEffect: () => {},
  useCallback: () => {},
  useMemo: () => {},
}));

// Mock @tanstack/react-query
mock.module("@tanstack/react-query", () => ({
  useQuery: () => ({ data: {}, isLoading: false }),
  useMutation: () => ({ mutate: () => {} }),
}));