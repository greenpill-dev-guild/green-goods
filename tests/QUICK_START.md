# Quick Start Guide - Fix Service Connectivity Issues

## ❌ Issue: "net::ERR_EMPTY_RESPONSE at https://localhost:3001/"

This error means the client service is not running. Here's how to fix it:

## ✅ Solution: Start Services First

### Option 1: Manual Service Startup (Recommended)

**Terminal 1 - Start Indexer:**
```bash
cd /Users/afo/Code/greenpill/green-goods
npm run dev:indexer
# or
pnpm dev:indexer
```

**Terminal 2 - Start Client:**
```bash
cd /Users/afo/Code/greenpill/green-goods
npm run dev:app
# or
pnpm dev:app
```

**Terminal 3 - Run Tests:**
```bash
# Check if services are running
node tests/run-tests.js check

# Run smoke tests (fastest)
node tests/run-tests.js smoke

# Expected output:
# ✅ Client service responding on port 3001 (status: 200)
# ✅ Indexer service responding on port 8080 (status: 200)
```

### Option 2: Use the Development Command

**Single Terminal:**
```bash
npm run dev
# This starts both indexer and client automatically
```

**Then in another terminal:**
```bash
node tests/run-tests.js smoke
```

### Option 3: Automatic Service Startup

```bash
# Let Playwright start services automatically (slower)
node tests/run-tests.js with-services
```

## 🔍 Troubleshooting

### Check What's Running on Ports
```bash
# Check if anything is using the ports
lsof -i :3001  # Client port (HTTPS)
lsof -i :8080  # Indexer port

# Kill processes if needed
pkill -f "dev:app"
pkill -f "dev:indexer"
```

### Service Health Check
```bash
# Verify services are responding
node tests/run-tests.js check

# Expected output if working:
# ✅ Indexer is running on port 8080 (GraphQL responding)
# ✅ Client is running on port 3001 (HTTPS 200)
# 🎯 Services are ready for testing!

# For detailed debugging of connectivity issues:
node tests/test-connectivity.js
```

### Browser Installation
```bash
# Install Playwright browsers if not already installed
npx playwright install
```

## ✅ Expected Working Flow

1. **Start services** (indexer + client)
2. **Check connectivity**: `node tests/run-tests.js check`
3. **Run smoke tests**: `node tests/run-tests.js smoke`
4. **See success**: Tests pass with service connectivity confirmed

## 🎯 Test Execution Order

```bash
# 1. Fastest validation (30 seconds)
node tests/run-tests.js smoke

# 2. Basic functionality (2 minutes)
node tests/run-tests.js quick

# 3. Mobile PWA tests (3 minutes)
node tests/run-tests.js mobile

# 4. Full test suite (10 minutes)
node tests/run-tests.js all
```

## 💡 Pro Tips

- **Always run smoke tests first** to validate your setup
- **Use `check` command** to diagnose service issues
- **Start services manually** during development for faster iteration
- **Use single project** (`--project=chromium`) for faster development testing
- **Client runs on HTTPS** due to mkcert plugin (for PWA features)

The tests are now **robust** and will provide clear error messages when services aren't available! 