// Each Vite/Storybook/docs app handles its own port collision via its package's
// `predev` / `prestorybook` script. PM2 just runs the package script directly.

module.exports = {
  apps: [
    {
      name: "docs",
      script: "sh",
      args: '-c "cd docs && bun run dev"',
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
    {
      name: "admin",
      script: "sh",
      args: '-c "cd packages/admin && bun run dev"',
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
    {
      name: "client",
      script: "sh",
      args: '-c "cd packages/client && bun run dev"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        VITE_ENABLE_SW_DEV: "false",
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
      // Disabled path exits 78 so PM2 stops restarting (see stop_exit_codes
      // below). Enabled path runs the bot and gets normal autorestart on crash.
      args:
        '-c "cd packages/agent && if grep -qE \'^TELEGRAM_BOT_TOKEN=.+\' ../../.env 2>/dev/null; then bun run dev; else echo \'Agent disabled — set TELEGRAM_BOT_TOKEN in .env to enable. PM2 will not restart this process.\'; exit 78; fi"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
      },
      merge_logs: true,
      autorestart: true,
      stop_exit_codes: [78],
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
