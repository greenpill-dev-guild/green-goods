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

const viteEnableSwDev = envValue("VITE_ENABLE_SW_DEV", "false");

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
        VITE_DEV_CHAIN_MODE: "arbitrum_fork",
        VITE_CHAIN_ID: "42161",
        VITE_LOCAL_FORK_RPC_URL: "http://127.0.0.1:3009",
        VITE_ENABLE_ANVIL_WALLETS: "true",
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
        VITE_DEV_CHAIN_MODE: "arbitrum_fork",
        VITE_CHAIN_ID: "42161",
        VITE_LOCAL_FORK_RPC_URL: "http://127.0.0.1:3009",
        VITE_ENABLE_ANVIL_WALLETS: "true",
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
        VITE_DEV_CHAIN_MODE: "arbitrum_fork",
        VITE_CHAIN_ID: "42161",
        VITE_LOCAL_FORK_RPC_URL: "http://127.0.0.1:3009",
        VITE_ENABLE_ANVIL_WALLETS: "true",
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
        VITE_DEV_CHAIN_MODE: "arbitrum_fork",
        VITE_CHAIN_ID: "42161",
        VITE_LOCAL_FORK_RPC_URL: "http://127.0.0.1:3009",
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
        '-c "cd packages/indexer && docker compose -f docker-compose.indexer.yaml up --build --watch"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        HASURA_EXTERNAL_PORT: "3006",
        INDEXER_EXTERNAL_PORT: "3007",
        ENVIO_PG_PORT: "3008",
        GREEN_GOODS_DEV_CHAIN_MODE: "arbitrum_fork",
        ARBITRUM_RPC_URL: "http://host.docker.internal:3009",
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
      // Default: tunnel both client (3001) and admin (3002). Standalone
      // `bun run dev:tunnel -- --port 3001` still works for single-port use.
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
