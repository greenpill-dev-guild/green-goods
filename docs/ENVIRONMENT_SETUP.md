# 🌍 Environment Configuration Guide

## TL;DR

```bash
cp .env.example .env  # Copy template
# Edit .env with your API keys (see .env.example comments)
pnpm dev              # Start everything
```

✅ **That's it! The root .env file works for all packages.**

## Overview

Green Goods uses a **centralized environment configuration** approach that supports both full-stack development and package isolation. This guide explains how to set up and use environment variables effectively.

## 🚀 Quick Start (Recommended)

```bash
# 1. Copy the root environment template
cp .env.example .env

# 2. Edit .env with your actual values
# (See sections below for where to get each value)

# 3. Start all services
pnpm dev

# 4. Verify services are running
pnpm exec pm2 list
```

✅ **This setup works for all packages and is the recommended approach for development.**

## 📦 Package Architecture

```
green-goods/
├── .env.example          # 🌍 Master environment template
├── .env                  # 🔒 Your actual environment (gitignored)
└── packages/
    ├── client/           # 📱 React frontend
    │   └── .env.example  # 📱 Client-specific variables
    ├── contracts/        # 📜 Solidity contracts
    │   └── .env.example  # 📜 Contract-specific variables
    └── indexer/          # 🔍 GraphQL indexer
        └── .env.example  # 🔍 Indexer-specific variables
```

## 🔧 Package Isolation (Advanced)

If you need to run a single package in isolation:

```bash
# Copy root config to package
cp .env packages/client/.env

# Edit package .env to keep only relevant variables
cd packages/client && pnpm dev
```

Each package's `.env.example` shows the minimal variables needed for isolation.

## 🔑 Environment Variables Reference

### 🔐 Authentication (Privy)

```bash
# Get from: https://console.privy.io
VITE_PRIVY_APP_ID="your-privy-app-id"              # Public app ID
PRIVY_APP_SECRET_ID="your-privy-app-secret"        # Server secret (KEEP SECURE!)

# For E2E testing (Dashboard > User management > Authentication > Advanced)
PRIVY_TEST_EMAIL="test-XXXX@privy.io"              # Your test email
PRIVY_TEST_OTP="XXXXXX"                            # Your test OTP
```

### ⛓️ Blockchain

```bash
# Network selection
VITE_CHAIN_ID="42161"                              # 42161=Arbitrum, 84532=Base Sepolia

# Blockchain access
FOUNDRY_KEYSTORE_ACCOUNT="green-goods-deployer"    # For secure deployments
ETHERSCAN_API_KEY="your-etherscan-v2-api-key"      # For contract verification

# Network RPC URLs
ARBITRUM_RPC_URL="https://arbitrum-mainnet.infura.io/v3/YOUR_KEY"
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
```

### 📁 File Storage (Pinata)

```bash
# Get from: https://pinata.cloud
VITE_PINATA_JWT="your-pinata-jwt"                  # For file uploads
```

### 🔍 Indexing (Envio)

```bash
# Get from: https://envio.dev/app/api-tokens
ENVIO_API_TOKEN="your-envio-token"                 # Indexer service
VITE_ENVIO_INDEXER_URL="your-indexer-url"          # GraphQL endpoint
```

### 📈 Analytics (PostHog) - Optional

```bash
# Get from: https://posthog.com
VITE_PUBLIC_POSTHOG_KEY="your-posthog-key"
VITE_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
```

### 🗄️ Databases (API) - Optional

```bash
POSTGRES_URL="your-postgres-url"                   # Main database
REDIS_URL="your-redis-url"                         # Cache/sessions
```

## 🎯 Development Workflows

### Full Stack Development
```bash
pnpm dev                      # Start all services
pnpm exec pm2 logs client     # View client logs
pnpm exec pm2 logs indexer    # View indexer logs
```

### Frontend Only
```bash
cd packages/client
cp ../../.env .env
pnpm dev
```

### Contract Development
```bash
cd packages/contracts
cp ../../.env .env
npm run deploy:celo              # Deploy to Celo
forge test                       # Run tests
```


## 🧪 Testing Setup

### E2E Tests (Offline Reconciliation)
```bash
# Ensure Privy test credentials are set
node tests/run-tests.js smoke          # Quick check (30s)
node tests/run-tests.js integration    # Core tests (3-5 min)
node tests/run-tests.js all            # Everything (10-15 min)
```

### Contract Tests
```bash
cd packages/contracts
forge test -vvv                  # Verbose contract tests
```

## 🚨 Security Best Practices

1. **Never commit `.env` files**
   ```bash
   # Already in .gitignore, but double-check:
   git status # Should NOT show .env files
   ```

2. **Use different credentials for different environments**
   ```bash
   .env              # Development
   .env.staging      # Staging
   .env.production   # Production
   ```

3. **Secure wallet management**
   ```bash
   # Use Foundry keystore for encrypted key storage
   cast wallet import green-goods-deployer --interactive
   
   # For production, use hardware wallets
   # Consider using encrypted environment variables
   # Rotate keys regularly
   ```

## 🔍 Troubleshooting

### Service Not Starting?
```bash
pnpm exec pm2 list               # Check service status
pnpm exec pm2 logs <service>     # Check logs
pnpm exec pm2 restart <service>  # Restart service
```

### Environment Variables Not Loading?
```bash
# Check if .env exists in correct location
ls -la .env

# Verify environment in running process
cd packages/client && pnpm dev
# Look for console logs showing loaded environment
```

### Test Account Issues?
```bash
# Verify Privy test credentials
echo $PRIVY_TEST_EMAIL
echo $PRIVY_TEST_OTP

# Check services are up before tests
node tests/run-tests.js check
```

### Network Connection Issues?
```bash
# Test RPC connectivity
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://sepolia.base.org

# Test indexer connectivity  
curl http://localhost:8080/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
```

## 📚 Additional Resources

- [Privy Authentication Docs](https://docs.privy.io/)
- [Envio Indexer Docs](https://docs.envio.dev/)
- [Pinata File Storage Docs](https://docs.pinata.cloud/)
- [PostHog Analytics Docs](https://posthog.com/docs)
- [Offline Work Reconciliation Tests](./tests/OFFLINE_TESTING.md)

---

🎉 **With this setup, you have a robust, secure, and developer-friendly environment configuration!**
