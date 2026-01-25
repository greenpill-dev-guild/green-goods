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
      restart_delay: 3000, // Wait 3s between restarts to allow port release
      kill_timeout: 5000,
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
    },
    {
      name: "agent",
      script: "sh",
      args: '-c "cd packages/agent && bun run dev"',
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
    },
    {
      name: "indexer",
      script: "sh",
      // Use Docker-based indexer to avoid macOS Rust panic in system-configuration crate
      // The Docker container runs PostgreSQL, Hasura, and the Envio indexer
      args: '-c "cd packages/indexer && docker compose -f docker-compose.indexer.yaml up --build"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
      },
      merge_logs: true,
      autorestart: false, // Docker Compose handles its own restarts
      max_restarts: 0,
      min_uptime: "10s",
      kill_timeout: 30000, // Longer timeout for Docker Compose to stop gracefully
    },
    {
      name: "storybook",
      script: "sh",
      args: '-c "cd packages/shared && bun run storybook"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        // Disable interactive prompts for port selection
        CI: "true",
      },
      merge_logs: true,
      autorestart: true,
      max_restarts: 3,
      min_uptime: "10s",
      restart_delay: 3000,
      kill_timeout: 5000,
    },
  ],
};
