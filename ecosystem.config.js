module.exports = {
  apps: [
    {
      name: "client",
      script: "sh",
      // Use default vite (aliased to rolldown-vite) for dev
      args: '-c "pnpm --filter client run dev"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
        VITE_ENABLE_SW_DEV: "false",
      },
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "indexer",
      script: "sh",
      args: '-c "pnpm --filter indexer run dev"',
      cwd: ".",
      env: {
        NODE_ENV: "development",
      },
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
