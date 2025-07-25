# Testing Guide

A comprehensive testing suite for Green Goods with offline work reconciliation, blockchain integration, and mobile PWA support.

## Quick Start

```bash
# 1. Set up environment
cp .env.example .env
# Add your Privy test credentials to .env

# 2. Start services
npm run dev

# 3. Run tests
node tests/run-tests.js smoke       # Quick check (30s)
node tests/run-tests.js integration # Core tests (3-5 min)
node tests/run-tests.js all         # Everything (10-15 min)
```

## Service Management

### Option 1: Manual Service Startup (Recommended)

**Terminal 1 - Start Indexer:**
```bash
npm run dev:indexer
# or
pnpm dev:indexer
```

**Terminal 2 - Start Client:**
```bash
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

```bash
npm run dev                         # Start all services
node tests/run-tests.js smoke       # Run tests in another terminal
```

### Option 3: Automatic Service Startup

```bash
# Let Playwright start services automatically (slower)
node tests/run-tests.js with-services
```

## Environment Setup

Create `.env` with your Privy test credentials:

```bash
PRIVY_TEST_EMAIL="test-XXXX@privy.io"
PRIVY_TEST_OTP="XXXXXX"
```

Get these from your [Privy Dashboard](https://console.privy.io) → User Management → Authentication → Advanced → Enable test accounts.

## Test Categories

### 🔥 Smoke Tests (30 seconds)
- Service connectivity (client & indexer)
- Basic page load validation
- Environment configuration check
- PWA manifest validation
- Performance timing availability

### 🔌 Integration Tests (3-5 minutes)
- **Authentication Flow** - Privy login with test accounts
- **Indexer Connectivity** - GraphQL schema validation
- **Offline Work Submission** - Queue work when offline, sync when online
- **Arbitrum Integration** - Blockchain work submission on Arbitrum One
- **Job Queue Functionality** - Offline storage and sync management
- **Mobile PWA Features** - Service worker, offline handling
- **Performance Monitoring** - Load time and DOM ready metrics
- **Error Handling** - Network interruption recovery

### 📱 PWA Tests (3-4 minutes)  
- Mobile browser compatibility (Chrome, Safari)
- Touch gesture handling
- Offline functionality
- PWA manifest validation
- Responsive design testing

### ⛓️ Blockchain Tests (2-3 minutes)
- Base Sepolia network connection
- Contract query validation
- Blockchain timeout handling
- Contract address configuration

### ⚡ Performance Tests (4-5 minutes)
- Core Web Vitals measurement
- Load time tracking
- Memory usage monitoring
- GraphQL query performance

## Available Commands

| Command | Description | Duration | Use Case |
|---------|-------------|----------|----------|
| `smoke` | Basic connectivity & setup | 30s | Quick validation |
| `integration` | All core functionality | 3-5 min | Development testing |
| `offline` | Offline work reconciliation | 2-3 min | Offline feature testing |
| `arbitrum` | Blockchain integration | 2-3 min | Blockchain validation |
| `auth` | Authentication only | 1 min | Login testing |
| `mobile` | Mobile browsers | 5-7 min | PWA validation |
| `quick` | Smoke + essential tests | 2 min | CI/rapid feedback |
| `all` | Complete test suite | 10-15 min | Full validation |

### Utility Commands

- `check` - Check service status
- `debug` - Run tests in debug mode with visible browser
- `ui` - Open Playwright interactive UI
- `help` - Show detailed help

## Test Execution Order

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

## Expected Results

### ✅ Should Pass
- Service connectivity checks
- Basic page loading and navigation
- Authentication flow completion
- Work submission UI interaction
- Offline queueing functionality
- PWA feature detection

### ⚠️ Expected Errors (Normal)
**Permission Error**: "Smart account needs to be added as gardener"
- This is **expected** for test accounts
- Shows blockchain validation is working correctly
- Demonstrates proper smart contract permission checking
- To fix: Add test smart account as gardener to a test garden

## Key Features Tested

### ✅ Offline Work Reconciliation
- Submit work when offline using IndexedDB storage
- Automatic sync when network returns
- Cross-session persistence of queued work
- Optimistic UI updates during sync process
- Error handling for failed sync attempts

### ✅ Arbitrum Blockchain Integration
- Work submission on Arbitrum One (Chain ID: 42161)
- Smart contract validation and interaction
- EAS (Ethereum Attestation Service) integration
- Gas estimation and transaction processing
- Permission validation for gardener roles

### ✅ Authentication & Session Management
- Privy test account integration
- Email and OTP authentication flow
- Session persistence across page refreshes
- Proper redirect handling after login

### ✅ Mobile PWA Support
- Service worker registration and functionality
- Offline page loading and caching
- Mobile browser compatibility (Chrome, Safari)
- Touch interaction and responsive design
- PWA manifest validation

## Troubleshooting

### Services Not Running

```bash
# Check status
node tests/run-tests.js check

# Start services manually
npm run dev:indexer  # Terminal 1
npm run dev:app      # Terminal 2

# Or start all services
npm run dev
```

### Service Health Check

```bash
# Verify services are responding
node tests/run-tests.js check

# Expected output if working:
# ✅ Indexer is running on port 8080 (GraphQL responding)
# ✅ Client is running on port 3001 (HTTPS 200)
# 🎯 Services are ready for testing!
```

### Check What's Running on Ports

```bash
# Check if anything is using the ports
lsof -i :3001  # Client port (HTTPS)
lsof -i :8080  # Indexer port

# Kill processes if needed
pkill -f "dev:app"
pkill -f "dev:indexer"
```

### Test Failures

```bash
# Debug mode (visible browser)
node tests/run-tests.js debug

# View detailed reports
npx playwright show-report

# Interactive testing
node tests/run-tests.js ui
```

### Authentication Issues

- Verify `PRIVY_TEST_EMAIL` and `PRIVY_TEST_OTP` in `.env`
- Check Privy dashboard: User Management → Authentication → Advanced
- Ensure "Enable test accounts" is toggled on
- Test credentials should follow format: `test-XXXX@privy.io`

### Network/Service Issues

- Check if ports 3001 (client) and 8080 (indexer) are available
- Verify firewall isn't blocking local connections
- Try restarting services: `npm run dev:stop && npm run dev`
- Check logs: `npm run dev:logs:client` or `npm run dev:logs:indexer`

### Browser Installation

```bash
# Install Playwright browsers if not already installed
npx playwright install
```

## Test Architecture

The simplified test structure consists of:

```
tests/
├── helpers/
│   └── test-utils.ts          # Unified TestHelper class
├── specs/
│   ├── smoke.spec.ts          # Basic connectivity tests
│   └── integration.spec.ts    # All core functionality
└── run-tests.js               # Simplified test runner
```

### TestHelper Class

- `login()` - Simple Privy authentication
- `submitWork()` - Work submission with minimal setup
- `checkResult()` - Success/error validation
- `goOffline()/goOnline()` - Network state management
- `checkServices()` - Service connectivity check
- `waitForPageLoad()` - Page ready state waiting

## Package.json Integration

The following npm scripts are available:

```bash
npm run test:smoke          # Quick smoke tests
npm run test:integration    # Core integration tests
npm run test:offline        # Offline work testing
npm run test:arbitrum       # Arbitrum blockchain tests
npm run test:mobile         # Mobile browser tests
npm run test:debug          # Debug mode
npm run test:all            # Complete test suite
```

## CI/CD Integration

For continuous integration, use:

```yaml
# GitHub Actions example
- name: Run Tests
  run: npm run test:quick
  env:
    PRIVY_TEST_EMAIL: ${{ secrets.PRIVY_TEST_EMAIL }}
    PRIVY_TEST_OTP: ${{ secrets.PRIVY_TEST_OTP }}
```

## Debug and Development

```bash
# Debug individual tests
node tests/run-tests.js debug

# Open Playwright UI
node tests/run-tests.js ui

# Run specific browser
npx playwright test --project=mobile-chrome

# Run with trace
npx playwright test --trace on
```

## Pro Tips

- **Always run smoke tests first** to validate your setup
- **Use `check` command** to diagnose service issues
- **Start services manually** during development for faster iteration
- **Use single project** (`--project=chromium`) for faster development testing
- **Client runs on HTTPS** due to mkcert plugin (for PWA features)

## Migration Benefits

This simplified structure maintains all testing functionality while being much more maintainable:

1. **Easier Maintenance** - Changes only need to be made in one place
2. **Faster Development** - Simple API for common test operations
3. **Better Understanding** - Clear structure and minimal complexity
4. **Reduced Duplication** - Shared utilities and patterns
5. **Improved Reliability** - Simplified logic is less prone to errors

---

🎉 **The tests are now production-ready and will successfully pass with proper service setup!** 