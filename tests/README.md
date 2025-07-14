# Green Goods E2E Testing

This directory contains the end-to-end testing suite for Green Goods, optimized for mobile PWA testing and blockchain integration.

## Structure

```
tests/
├── fixtures/           # Test data and utilities
│   └── test-data.ts    # Test data factories and constants
├── pages/              # Page Object Model classes
│   └── base.page.ts    # Base page with common functionality
├── specs/              # Test specifications organized by feature
│   ├── integration/    # Basic integration tests
│   ├── blockchain/     # Base Sepolia blockchain tests
│   ├── pwa/           # PWA and mobile-specific tests
│   └── performance/   # Performance monitoring tests
├── global-setup.ts    # Global test setup
└── global-teardown.ts # Global test cleanup
```

## Running Tests

### Quick Start
```bash
# Using the test runner (recommended)
node tests/run-tests.js smoke      # Basic validation
node tests/run-tests.js quick      # Smoke + integration
node tests/run-tests.js all        # All tests

# Check if services are running
node tests/run-tests.js check

# Run with automatic service startup
node tests/run-tests.js with-services
```

### All Tests
```bash
pnpm test:e2e
```

### Specific Test Suites
```bash
# Smoke tests (fastest)
pnpm test:e2e:smoke

# Mobile PWA tests
pnpm test:e2e:mobile

# Integration tests
pnpm test:e2e:integration

# Blockchain tests
pnpm test:e2e:blockchain

# PWA features
pnpm test:e2e:pwa

# Performance tests
pnpm test:e2e:performance

# Quick validation
pnpm test:e2e:quick

# All tests (unit + e2e)
pnpm test:all
```

### Debug Mode
```bash
# Interactive UI
pnpm test:e2e:ui

# Debug mode
pnpm test:e2e:debug

# Using test runner
node tests/run-tests.js debug
node tests/run-tests.js ui
```

### Different Service Modes
```bash
# Services already running
SKIP_WEBSERVER=true npx playwright test

# Let Playwright start services
SKIP_WEBSERVER=false npx playwright test

# Skip health checks
SKIP_HEALTH_CHECK=true npx playwright test
```

## Features

### 1. Mobile-First Testing
- **Primary Focus**: Mobile Chrome and Safari for PWA testing
- **Responsive Design**: Tests across different viewport sizes
- **Touch Interactions**: Mobile gesture testing
- **Offline Support**: PWA offline functionality tests

### 2. Blockchain Integration
- **Base Sepolia**: Tests deployed contracts on Base Sepolia testnet
- **GraphQL Indexer**: Validates indexer connectivity and data
- **Performance**: Blockchain-specific timeout handling
- **Contract Interaction**: Tests contract deployment and interaction

### 3. Service Management
- **Automatic Startup**: Starts indexer and client automatically
- **Health Checks**: Validates services before running tests
- **Environment**: Proper test environment configuration

### 4. Performance Monitoring
- **Core Web Vitals**: FCP, LCP measurements
- **Load Times**: Page load performance tracking
- **Memory Usage**: JavaScript heap monitoring
- **Network**: GraphQL query performance

### 5. Test Data Management
- **Factories**: Dynamic test data generation
- **Environment**: Base Sepolia configuration
- **Cleanup**: Proper test data cleanup

## Configuration

### Environment Variables
Tests use these environment variables (set automatically by global setup):
- `TEST_INDEXER_URL`: GraphQL indexer endpoint (HTTP)
- `TEST_CLIENT_URL`: Client application URL (HTTPS due to mkcert)
- `TEST_CHAIN_ID`: Blockchain network ID (84532 for Base Sepolia)

### Browser Projects
- `chromium`: Desktop Chrome for development
- `mobile-chrome`: Mobile Chrome (Pixel 5 simulation)
- `mobile-safari`: Mobile Safari (iPhone 12 simulation)
- `tablet`: Tablet testing (iPad Pro simulation)

### Important Notes
- **Client uses HTTPS**: The Vite dev server runs on `https://localhost:3001` due to the mkcert plugin (required for PWA features)
- **Indexer uses HTTP**: The indexer runs on `http://localhost:8080` 
- **Self-signed certificates**: Tests automatically accept mkcert's self-signed certificates

## Development

### Adding New Tests
1. Create test files in appropriate `specs/` subdirectory
2. Use Page Object Model patterns from `pages/`
3. Leverage test data from `fixtures/test-data.ts`
4. Follow mobile-first approach

### Page Objects
Extend `BasePage` for common functionality:
- Loading state management
- Error handling
- PWA feature detection
- Mobile gesture simulation
- Blockchain transaction waiting

### Test Data
Use factories from `test-data.ts`:
```typescript
import { testGardens, testActions } from '../fixtures/test-data';

const garden = testGardens.create();
const action = testActions.sample();
```

## Integration with Existing Tests

The e2e tests complement the existing test suite:
- **Vitest**: Unit tests for individual components
- **Playwright**: End-to-end user workflows
- **Foundry**: Smart contract testing

Run all tests together:
```bash
pnpm test:all
```

## CI/CD Integration

Tests are configured for CI environments:
- Optimized worker configuration
- Enhanced retry logic for blockchain operations
- Comprehensive reporting (HTML, JSON, JUnit)
- Artifact collection for debugging

## Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check if ports are in use
lsof -i :3001  # Client port
lsof -i :8080  # Indexer port

# Kill processes if needed
pkill -f "dev:app"
pkill -f "dev:indexer"
```

#### Tests Failing to Find Services
```bash
# Run health check
node tests/run-tests.js check

# Start services manually
npm run dev:indexer  # Terminal 1
npm run dev:app      # Terminal 2

# Run tests without service startup
SKIP_WEBSERVER=true npx playwright test
```

#### Package Manager Issues
```bash
# If pnpm commands fail, the config will fallback to npm
# Or force npm usage:
npm run dev:indexer
npm run dev:app
```

#### Browser Issues
```bash
# Install browsers
npx playwright install

# Install system dependencies
npx playwright install-deps
```

### Test Development Tips

1. **Start with smoke tests**: Always run `node tests/run-tests.js smoke` first
2. **Use debug mode**: `node tests/run-tests.js debug` for step-by-step debugging
3. **Check mobile viewport**: Use `--project=mobile-chrome` for mobile-specific issues
4. **Service isolation**: Use `SKIP_WEBSERVER=true` when services are already running
5. **Environment variables**: Tests use fallback URLs if env vars aren't set

### Performance Optimization

- Use `--project=chromium` for fastest testing during development
- Run `smoke` tests for quick validation
- Use `quick` command for basic functionality checks
- Save full test suites for CI or comprehensive testing 