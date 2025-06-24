module.exports = {
  apps: [{
    name: 'green-goods-mcp-server',
    script: './build/index.js',
    args: '--http',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      MCP_SERVER_PORT: 8000
    },
    env_development: {
      NODE_ENV: 'development',
      MCP_SERVER_PORT: 8000
    }
  }]
}; 