// Each Vite/Storybook/docs app now performs read-only port checks before start.
// This repo-owned PM2 stack owns cleanup for root `bun run dev`.

const fs = require("node:fs");
const path = require("node:path");

const rootEnv = parseRootEnv();

function parseRootEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return {};

  const env = {};
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function envValue(key, fallback = "") {
  return process.env[key] || rootEnv[key] || fallback;
}

function envFlag(key) {
  return envValue(key, "false").trim().toLowerCase() === "true";
}

const viteEnableSwDev = envValue("VITE_ENABLE_SW_DEV", "false");
const localAgentApiBaseUrl = "http://127.0.0.1:3005";
const localIndexerUrl = "http://localhost:3006/v1/graphql";
const hostedAgentApiBaseUrl = "https://agent.greengoods.app";
const hostedIndexerUrl = "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";

const viteDisableLocalChain = envFlag("VITE_DISABLE_LOCAL_CHAIN");
const viteDisableLocalIndexer = envFlag("VITE_DISABLE_LOCAL_INDEXER");
const viteDisableLocalAgent = envFlag("VITE_DISABLE_LOCAL_AGENT");

// Setup writes the local agent URL into the baseline root .env, so a configured value
// replaces the local agent only when it is an absolute, non-loopback http(s) URL.
function isExternalHttpUrl(value) {
  try {
    const url = new URL(value);
    // Drop a trailing DNS root dot so "localhost." still reads as loopback.
    const hostname = url.hostname.replace(/\.$/, "");
    const loopback =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "0.0.0.0" ||
      /^127\./.test(hostname) ||
      hostname === "[::]" ||
      hostname === "[::1]" ||
      // IPv4-mapped loopback, e.g. [::ffff:127.0.0.1] serializes as [::ffff:7f00:1].
      /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(hostname);
    return (url.protocol === "http:" || url.protocol === "https:") && !loopback;
  } catch {
    return false;
  }
}

const externalAgentApiBaseUrl = isExternalHttpUrl(rootEnv.VITE_API_BASE_URL)
  ? rootEnv.VITE_API_BASE_URL
  : hostedAgentApiBaseUrl;
const externalIndexerUrl = isExternalHttpUrl(rootEnv.VITE_ENVIO_INDEXER_URL)
  ? rootEnv.VITE_ENVIO_INDEXER_URL
  : hostedIndexerUrl;
const localViteChainEnv = viteDisableLocalChain
  ? {
      VITE_DEV_CHAIN_MODE: "",
      VITE_CHAIN_ID: rootEnv.VITE_CHAIN_ID || "11155111",
      VITE_LOCAL_FORK_RPC_URL: "",
      VITE_ENABLE_ANVIL_WALLETS: "false",
    }
  : {
      VITE_DEV_CHAIN_MODE: "",
      VITE_CHAIN_ID: "42161",
      VITE_LOCAL_FORK_RPC_URL: "",
      VITE_ENABLE_ANVIL_WALLETS: "false",
    };
const localViteIndexerEnv = {
  VITE_ENVIO_INDEXER_URL: viteDisableLocalIndexer ? externalIndexerUrl : localIndexerUrl,
};
const localViteAgentEnv = {
  VITE_API_BASE_URL: viteDisableLocalAgent ? externalAgentApiBaseUrl : localAgentApiBaseUrl,
};
const localViteControlEnv = {
  VITE_DISABLE_LOCAL_CHAIN: String(viteDisableLocalChain),
  VITE_DISABLE_LOCAL_INDEXER: String(viteDisableLocalIndexer),
  VITE_DISABLE_LOCAL_AGENT: String(viteDisableLocalAgent),
};

module.exports = {
  apps: [
    {
      name: "anvil-arbitrum",
      script: "sh",
      args: '-c "cd packages/contracts && bun run dev:arbitrum-fork"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        ANVIL_PORT: "3009",
      },
      merge_logs: true,
      autorestart: false,
      max_restarts: 0,
      min_uptime: "5s",
      kill_timeout: 5000,
      treekill: true,
    },
    {
      name: "docs",
      script: "sh",
      args: '-c "cd docs && bun run dev"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        ...localViteControlEnv,
        ...localViteChainEnv,
        ...localViteIndexerEnv,
        ...localViteAgentEnv,
      },
      merge_logs: true,
      autorestart: true,
      max_restarts: 3,
      min_uptime: "10s",
      restart_delay: 3000,
      kill_timeout: 5000,
      treekill: true,
    },
    {
      name: "admin",
      script: "sh",
      args: '-c "cd packages/admin && bun run dev"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        ...localViteControlEnv,
        ...localViteChainEnv,
        ...localViteIndexerEnv,
        ...localViteAgentEnv,
      },
      merge_logs: true,
      autorestart: true,
      max_restarts: 3,
      min_uptime: "10s",
      restart_delay: 3000,
      kill_timeout: 5000,
      treekill: true,
    },
    {
      name: "client",
      script: "sh",
      args: '-c "cd packages/client && bun run dev"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        VITE_ENABLE_SW_DEV: viteEnableSwDev,
        VITE_USE_POLLING: envValue("VITE_USE_POLLING", "true"),
        ...localViteControlEnv,
        ...localViteChainEnv,
        ...localViteIndexerEnv,
        ...localViteAgentEnv,
      },
      merge_logs: true,
      autorestart: true,
      max_restarts: 3,
      min_uptime: "10s",
      restart_delay: 3000,
      kill_timeout: 5000,
      treekill: true,
    },
    {
      name: "agent",
      script: "sh",
      args: '-c "cd packages/agent && bun run dev"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        PORT: "3005",
        HOST: "127.0.0.1",
        AGENT_DISABLE_TELEGRAM_RUNTIME: "true",
        ARBITRUM_RPC_URL: "https://arb1.arbitrum.io/rpc",
        VITE_DEV_CHAIN_MODE: "",
        VITE_CHAIN_ID: "42161",
        VITE_ENVIO_INDEXER_URL: "http://localhost:3006/v1/graphql",
        VITE_LOCAL_FORK_RPC_URL: "",
      },
      merge_logs: true,
      autorestart: true,
      max_restarts: 3,
      min_uptime: "10s",
      restart_delay: 3000,
      kill_timeout: 5000,
      treekill: true,
    },
    {
      name: "indexer",
      script: "sh",
      // Use Docker-based indexer to avoid macOS Rust panic in system-configuration crate.
      // `up --build --watch` builds the image once, starts the stack, and then watches
      // host paths declared in `develop.watch` (see docker-compose.indexer.yaml).
      // src + config edits → sync + container restart (~1-2s).
      // schema/Dockerfile/package.json edits → image rebuild + restart.
      args:
        '-c "cd packages/indexer && docker compose -f docker-compose.indexer.yaml up --build --watch --abort-on-container-failure"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        HASURA_EXTERNAL_PORT: "3006",
        INDEXER_EXTERNAL_PORT: "3007",
        ENVIO_PG_PORT: "3008",
        GREEN_GOODS_DEV_CHAIN_MODE: "",
        ARBITRUM_RPC_URL: "https://arb1.arbitrum.io/rpc",
        ENVIO_API_TOKEN: envValue("ENVIO_API_TOKEN"),
        ENVIO_HYPERSYNC_CLIENT_TIMEOUT_MILLIS:
          envValue("ENVIO_HYPERSYNC_CLIENT_TIMEOUT_MILLIS", "120000"),
        ENVIO_HYPERSYNC_CLIENT_MAX_RETRIES:
          envValue("ENVIO_HYPERSYNC_CLIENT_MAX_RETRIES", "0"),
      },
      merge_logs: true,
      autorestart: false, // Docker Compose handles its own restarts
      max_restarts: 0,
      min_uptime: "10s",
      kill_timeout: 30000, // Longer timeout for Docker Compose to stop gracefully
      treekill: true,
    },
    {
      name: "tunnel",
      script: "node",
      // Opt-in: tunnel both client (3001) and admin (3002). Standalone
      // `node scripts/dev/tunnel.js -- --port 3001` still works for single-port use.
      args: "scripts/dev/tunnel.js --port 3001 --port 3002",
      cwd: ".",
      env: {
        NODE_ENV: "development",
      },
      merge_logs: true,
      autorestart: false, // cloudflared exits cleanly or is not installed
      max_restarts: 0,
      min_uptime: "5s",
      kill_timeout: 5000,
      treekill: true,
    },
    {
      name: "browser",
      script: "bash",
      args: "scripts/dev/open-urls.sh",
      cwd: ".",
      merge_logs: true,
      autorestart: false,
      max_restarts: 0,
      min_uptime: "2s",
      kill_timeout: 5000,
      treekill: true,
    },
    {
      name: "storybook",
      script: "sh",
      args: '-c "cd packages/shared && bun run storybook"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
      },
      merge_logs: true,
      autorestart: true,
      max_restarts: 3,
      min_uptime: "10s",
      restart_delay: 3000,
      kill_timeout: 5000,
      treekill: true,
    },
  ],
};
