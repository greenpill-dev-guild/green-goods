# Testing Guide

A comprehensive testing suite for Green Goods with offline work reconciliation, blockchain integration, and mobile PWA support.

## Quick Start

```bash
# 1. Set up environment
cp .env.example .env
# Add your Privy test credentials to .env

# 2. Start services
bun dev

# 3. Run tests
node tests/run-tests.js smoke       # Quick check (30s)
node tests/run-tests.js integration # Core tests (3-5 min)
node tests/run-tests.js all         # Everything (10-15 min)
```

## Service Management

### Option 1: Manual Service Startup (Recommended)

**Terminal 1 - Start Indexer:**
```bash
bun dev:indexer
```

**Terminal 2 - Start Client:**
```bash
bun dev:app
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
bun dev                         # Start all services
node tests/run-tests.js smoke    # Run tests in another terminal
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
bun dev:indexer  # Terminal 1
bun dev:app      # Terminal 2

# Or start all services
bun dev
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
- Try restarting services: `bun dev:stop && bun dev`
- Check logs: `bun dev:logs:client` or `bun dev:logs:indexer`

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

## Contract Testing

Smart contract testing uses Foundry for comprehensive Solidity test coverage.

### Running Contract Tests

```bash
cd packages/contracts

# Compile contracts
forge build

# Run all tests
forge test

# Run specific test contract
forge test --match-contract GardenAccountTest

# Run with gas reporting
forge test --gas-report

# Generate coverage report
forge coverage
```

### Test Organization

```
packages/contracts/test/
├── ActionRegistry.t.sol      - Action registry tests
├── GardenToken.t.sol         - Garden token and ERC721 tests
├── GardenAccount.t.sol       - Garden account and TBA tests
├── WorkResolver.t.sol        - Work attestation resolver tests
├── WorkApprovalResolver.t.sol - Work approval resolver tests
├── AssessmentResolver.t.sol  - Assessment attestation resolver tests
├── DeploymentRegistry.t.sol  - Deployment registry and governance tests
├── Integration.t.sol         - Full workflow integration tests
├── FuzzTests.t.sol           - Fuzz testing for edge cases
├── Deploy.t.sol              - Integration deployment tests
└── DeploymentTest.t.sol      - Deployment verification tests
```

### Test Coverage Targets

- **Overall Contracts**: 90% minimum coverage
- **Core logic**: 95%+ coverage
- **Critical paths**: 100% coverage required
- **Security features**: 100% coverage required

### Coverage by Contract

| Contract | Target | Status |
|----------|--------|--------|
| GardenToken | 95% | ✅ Enhanced |
| GardenAccount | 95% | ✅ Enhanced |
| ActionRegistry | 95% | ✅ Enhanced |
| WorkResolver | 90% | ✅ Enhanced |
| WorkApprovalResolver | 90% | ✅ Enhanced |
| AssessmentResolver | 90% | ✅ New tests added |
| DeploymentRegistry | 95% | ✅ Enhanced |
| Integration Tests | N/A | ✅ Added |
| Fuzz Tests | N/A | ✅ Added |

### Test Patterns

**Setup with Proxies:**
```solidity
function setUp() public {
    // Deploy implementation
    ActionRegistry implementation = new ActionRegistry();
    
    // Deploy proxy with initialization
    bytes memory initData = abi.encodeWithSelector(
        ActionRegistry.initialize.selector,
        multisig
    );
    ERC1967Proxy proxy = new ERC1967Proxy(
        address(implementation),
        initData
    );
    
    actionRegistry = ActionRegistry(address(proxy));
}
```

**Testing Upgrades:**
```solidity
function testUpgrade() public {
    ActionRegistry newImpl = new ActionRegistry();
    vm.prank(owner);
    UUPSUpgradeable(address(actionRegistry)).upgradeTo(address(newImpl));
}
```

### Integration Tests

The `Integration.t.sol` file contains comprehensive workflow tests:

```solidity
// Full workflow tests
function testCompleteHappyPath() public
function testMultipleGardensIndependence() public
function testBatchMinting() public
function testActionLifecycle() public
function testGardenMemberManagement() public
function testInviteSystemWorkflow() public
function testAccessControlAcrossContracts() public
```

**Coverage**: All major workflows including mint → action → work → approval

### Fuzz Tests

The `FuzzTests.t.sol` file uses Foundry's fuzzing to test edge cases:

```solidity
// Fuzz tests with random inputs
function testFuzz_ActionRegistrationWithRandomTimes(uint64, uint32) public
function testFuzz_GardenMintingWithRandomStrings(uint8, uint8) public
function testFuzz_BatchMintingWithRandomSizes(uint8) public
function testFuzz_ArrayLengthValidation(uint8) public
function testFuzz_CapitalCombinations(uint8) public
```

**Benefits**: Automatically discovers edge cases and boundary conditions

### Security Test Focus

Enhanced test coverage for security-critical areas:

- **Access Control**: All privileged functions have negative tests
- **Input Validation**: Array length limits, time validation
- **State Transitions**: Upgrade scenarios, ownership transfers  
- **Edge Cases**: Boundary conditions, integer limits
- **Integration**: Cross-contract interactions

### Gas Benchmarks

Expected gas costs for key operations (see `docs/GAS_LIMITS.md` for details):
- Garden creation: ~600K gas
- Batch garden creation (10): ~6M gas (~40% savings)
- Action registration: ~250K gas
- Work submission: ~150K gas
- Work approval: ~180K gas
- Invite code usage: ~60K gas

## Admin Dashboard Testing

The admin package uses Vitest + React Testing Library for component and integration tests.

### Running Admin Tests

```bash
cd packages/admin

# Fast unit tests (development)
bun test:unit

# Integration tests (requires Base Sepolia)
bun test:integration

# All tests
bun test

# Watch mode
bun test:watch

# Coverage report
bun test:coverage

# Interactive UI
bun test:ui
```

### Test Structure

```
packages/admin/src/__tests__/
├── hooks/                    - React hook tests
│   ├── useRole.test.ts      - Role detection
│   ├── useChainSync.test.ts - Chain switching
│   └── useToastAction.test.ts - Toast notifications
├── components/               - Component tests
│   ├── RequireAuth.test.tsx - Auth guards
│   └── RequireRole.test.tsx - Role-based access
├── workflows/                - Workflow state machines
│   └── createGarden.test.ts - Garden creation flow
└── integration/              - E2E integration tests
    └── garden-lifecycle.test.ts - Full garden workflow
```

### Mocking Strategy

**Privy Authentication:**
```typescript
// Mock user roles
const mockAdmin = createMockPrivyUser("admin");
const mockOperator = createMockPrivyUser("operator");
```

**Blockchain Interactions:**
```typescript
// Mock successful transactions
mockWalletClient.writeContract.mockResolvedValue(MOCK_TX_HASH);
```

**GraphQL Queries:**
```typescript
// MSW handlers for indexer
graphql.query("GetGardens", () => 
  HttpResponse.json({ data: { gardens: [...] }})
);
```

### Performance Metrics

- **Unit tests**: ~3 seconds
- **Integration tests**: ~30 seconds
- **Coverage target**: >80%

---

🎉 **The tests are now production-ready and will successfully pass with proper service setup!**