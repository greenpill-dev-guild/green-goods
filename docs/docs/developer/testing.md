# Testing & QA

Comprehensive testing strategy across all Green Goods packages.

---

## Testing Overview

| Package | Framework | Coverage Target | Command |
|---------|-----------|----------------|---------|
| **Client** | Vitest + Testing Library | 70%+ (80%+ critical) | `bun --filter client test` |
| **Admin** | Vitest + Testing Library | 70%+ | `bun --filter admin test` |
| **Shared** | Vitest | 80%+ (core logic) | `bun --filter shared test` |
| **Agent** | Vitest | 70%+ | `bun --filter agent test` |
| **Indexer** | Envio Test Helpers | Key handlers | `bun --filter indexer test` |
| **Contracts** | Foundry | 80%+ (100% mainnet) | `bun --filter contracts test` |
| **E2E** | Playwright | Login + key flows | `bun test:e2e:smoke` |

---

## Running Tests

### All Tests

```bash
bun test           # All unit/integration tests
bun test:e2e       # E2E tests (requires services running)
```

### Package-Specific

```bash
bun --filter client test
bun --filter admin test
bun --filter shared test
bun --filter contracts test
bun --filter agent test
bun --filter indexer test
```

### Watch Mode

```bash
bun --filter client test:watch
```

### Coverage

```bash
bun --filter client coverage
bun --filter shared coverage
forge coverage  # Contracts
```

---

## E2E Testing (Playwright)

### Quick Start

```bash
# Start services
bun dev

# Run smoke tests (client + admin)
bun test:e2e:smoke

# Platform-specific
bun test:e2e:client    # Client PWA (Chromium)
bun test:e2e:admin     # Admin dashboard (Chromium)
bun test:e2e:android   # Client PWA (Android Chrome, passkey)
bun test:e2e:ios       # Client PWA (iOS Safari, wallet)

# Debug with UI
bun test:e2e:ui
```

### Platform Coverage

| Platform | Browser | Auth Method | Coverage |
|----------|---------|-------------|----------|
| **Client (Android)** | Chrome (Pixel 5) | Passkey (virtual WebAuthn) | ✅ Full automated |
| **Client (iOS)** | Safari (iPhone 13) | Wallet (storage injection) | ✅ Basic smoke |
| **Admin (Desktop)** | Chromium | Wallet (storage injection) | ✅ Full automated |

**Why different auth methods?**
- **Android Chrome** supports virtual WebAuthn authenticator (full passkey testing)
- **iOS Safari** doesn't support virtual WebAuthn (use wallet injection instead)
- **Admin** uses wallet-only auth (operators don't use passkeys)

### Test Structure

```
tests/
├── specs/
│   ├── client.smoke.spec.ts  # Client PWA (login + view gardens)
│   └── admin.smoke.spec.ts   # Admin dashboard (login + view gardens)
├── helpers/
│   └── test-utils.ts         # ClientTestHelper, AdminTestHelper
├── global-setup.ts            # Health checks, env vars
└── run-tests.ts               # Test runner CLI
```

### Writing E2E Tests

**Client test (Android/Chromium - Passkey):**
```typescript
import { ClientTestHelper } from "../helpers/test-utils";

test("can view gardens", async ({ page }, testInfo) => {
  const helper = new ClientTestHelper(page);
  const ios = testInfo.project.name === "mobile-safari";

  if (ios) {
    // iOS - wallet injection
    await helper.injectWalletAuth();
    await page.goto("/home");
  } else {
    // Android/Chromium - passkey
    await helper.setupPasskeyAuth();
    await helper.createPasskeyAccount(`test_${Date.now()}`);
  }

  // Assertions...
  await expect(page.locator('[data-testid="garden-card"]').first()).toBeVisible();
});
```

**Admin test (Wallet injection):**
```typescript
import { AdminTestHelper } from "../helpers/test-utils";

test("can access dashboard", async ({ page }) => {
  const helper = new AdminTestHelper(page);
  await helper.injectWalletAuth();
  
  await page.goto("/dashboard");
  await expect(page.locator("nav")).toBeVisible();
});
```

### Watch Tests Run

Two ways to observe test execution:

| Mode | Command | Best For |
|------|---------|----------|
| **Playwright UI** | `bun test:e2e:ui` | Time-travel debugging, DOM inspection |
| **Headed Browser** | `bun tests/run-tests.ts headed` | Quick visual verification |

```bash
# Playwright UI (time-travel debugging)
bun test:e2e:ui

# Headed mode (watch browser execute)
bun tests/run-tests.ts headed

# Debug specific test with breakpoints
npx playwright test tests/specs/client.smoke.spec.ts --debug
```

**For manual inspection**, use Cursor browser MCP:
```
@browser navigate to https://localhost:3001
@browser snapshot
@browser click on element
```

### E2E Test Documentation

Full technical details:
- **Quick reference**: [`tests/README.md`](https://github.com/greenpill-dev-guild/green-goods/tree/main/tests#readme)
- **Architecture deep dive**: [`tests/ARCHITECTURE.md`](https://github.com/greenpill-dev-guild/green-goods/tree/main/tests/ARCHITECTURE.md)
- **Cursor workflows**: [`cursor-workflows.md`](cursor-workflows) - Issue→Agent→Tests→Fix flow

---

## Client Testing

### Test Categories

- **Component tests** - UI components with Testing Library
- **Hook tests** - Custom React hooks
- **Module tests** - Job queue, auth, data modules
- **Integration tests** - Multi-component flows

### Example: Job Queue Test

```typescript
describe('JobQueue', () => {
  it('adds job and processes when online', async () => {
    const queue = new JobQueue();
    await queue.addJob({ type: 'work', data: {...} });
    expect(queue.getStats().pending).toBe(1);
  });
});
```

### Key Test Areas

- ✅ Offline queue processing
- ✅ Passkey authentication (XState machine)
- ✅ Work submission (online + offline)
- ✅ EAS attestation creation
- ✅ Media upload (IPFS)
- ✅ Image compression

**Location**: `packages/client/src/__tests__/`

---

## Admin Testing

### Test Categories

- **Component tests** - Garden forms, action forms
- **Route guard tests** - RequireAuth, RequireDeployer
- **Integration tests** - Garden creation workflow
- **Role-based tests** - Operator vs Deployer permissions

### Example: Access Control Test

```typescript
it('admin can create garden and add members', async () => {
  const { user } = renderWithProviders(<App />, { userRole: 'deployer' });
  
  await user.click(screen.getByText('Create Garden'));
  await user.type(screen.getByLabelText('Name'), 'Test Garden');
  await user.click(screen.getByText('Submit'));
  
  expect(screen.getByText('Test Garden')).toBeInTheDocument();
});
```

### Key Test Areas

- ✅ Role-based access control
- ✅ Garden management (CRUD)
- ✅ Action registration
- ✅ Member management
- ✅ Contract deployment validation

**Location**: `packages/admin/src/__tests__/`

---

## Shared Package Testing

### Test Categories

- **Hook tests** - All custom hooks (auth, garden, work)
- **Provider tests** - Auth, JobQueue, Work providers
- **Store tests** - Zustand stores
- **Module tests** - Core business logic
- **Workflow tests** - XState machines

### Example: Hook Test

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../hooks/auth/useAuth';

it('authenticates with passkey', async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: TestProviders });
  
  act(() => {
    result.current.createAccount('username');
  });
  
  await waitFor(() => {
    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

### Key Test Areas

- ✅ Authentication state machine
- ✅ Job queue (add, process, retry, sync)
- ✅ Work submission (wallet + bot paths)
- ✅ Query key management
- ✅ Toast presets (i18n)
- ✅ Date/time utilities

**Location**: `packages/shared/src/__tests__/`

**Coverage target**: 80%+ (shared is core logic)

---

## Contract Testing (Foundry)

### Running Tests

```bash
cd packages/contracts

forge test                      # All tests
forge test --match-test testGarden  # Specific contract
forge test -vvv                 # Verbose (stack traces)
forge test --gas-report         # Gas analysis
forge coverage                  # Coverage report
```

### Test Categories

- **Unit tests** - Individual contract functions
- **Integration tests** - Multi-contract flows (GreenGoodsResolver fan-out)
- **E2E workflow** - Full garden → action → work → approval flow
- **Upgrade safety** - UUPS upgrade validation
- **Fuzz tests** - Property-based testing

### Example: Unit Test

```solidity
function testGardenToken_mintsNewGarden() public {
    vm.prank(deployer);
    uint256 tokenId = gardenToken.mintGarden(
        owner,
        "Test Garden",
        "ipfs://metadata",
        gardeners,
        operators
    );
    assertEq(tokenId, 1);
}
```

### Example: Integration Test

```solidity
function testGreenGoodsResolver_fanOutOnWorkApproval() public {
    // Setup garden + work
    uint256 tokenId = _createGarden();
    bytes32 workUID = _submitWork(tokenId);
    
    // Approve work (triggers resolver fan-out)
    vm.expectEmit(true, true, false, true);
    emit ModuleExecutionSuccess(MODULE_OCTANT, gardenAddress, workUID);
    
    _approveWork(workUID);
    
    // Verify Octant vault created
    address vault = octantModule.getVault(gardenAddress);
    assertTrue(vault != address(0));
}
```

### Key Test Areas

- ✅ Access control (onlyOwner, role checks)
- ✅ EAS attestation validation
- ✅ Module fan-out (try/catch isolation)
- ✅ Token-bound account creation
- ✅ Storage gap validation (UUPS upgrades)
- ✅ Gas optimization

**Location**: `packages/contracts/test/`

**Coverage targets**:
- Testnet: 80%+ acceptable
- Mainnet: 100% tests must pass

---

## Indexer Testing (Envio)

### Running Tests

```bash
cd packages/indexer
bun test
```

### Test Structure

Uses Envio's mock database for event handler testing:

```typescript
import { TestHelpers, GardenToken } from "generated";
const { MockDb } = TestHelpers;

it("handles GardenMinted event", async () => {
  let mockDb = MockDb.createMockDb();
  
  const mockEvent = GardenToken.GardenMinted.createMockEvent({
    tokenId: 1n,
    account: "0xGardenAccount",
    name: "Test Garden",
    // ...
  });
  
  const result = await GardenToken.GardenMinted.processEvent({
    event: mockEvent,
    mockDb,
  });
  
  const garden = result.entities.Garden.get("0xGardenAccount");
  expect(garden.name).toBe("Test Garden");
});
```

### Key Test Areas

- ✅ Capital type mapping (8 types + UNKNOWN)
- ✅ Multi-chain ID collision prevention
- ✅ Bidirectional relationships (Garden ↔ Gardener)
- ✅ Create-if-not-exists patterns
- ✅ Metadata parsing

**Location**: `packages/indexer/test/test.ts`

**Coverage**: Event handler logic (27+ tests)

---

## Agent Testing (Telegram Bot)

### Running Tests

```bash
cd packages/agent
bun test
```

### Test Categories

- **Handler tests** - Command handlers (pure functions)
- **Service tests** - External integrations (mocked)
- **Platform tests** - Message transformation

### Example: Command Handler Test

```typescript
import { handleStart } from "../handlers/start";

it("creates new user with encrypted key", async () => {
  const message = createMockMessage({ command: "/start" });
  
  const result = await handleStart(message, {
    generatePrivateKey: vi.fn(() => "0xPrivateKey"),
  });
  
  expect(result.response.text).toContain("Welcome");
  expect(result.user).toBeDefined();
  expect(result.user.encryptedKey).toBeTruthy();
});
```

### Key Test Areas

- ✅ Command routing
- ✅ Session management
- ✅ Key encryption/decryption
- ✅ Work submission
- ✅ Approval flow
- ✅ Rate limiting

**Location**: `packages/agent/src/__tests__/`

---

## Pre-Commit Checklist

Before committing code, run:

```bash
# 1. Format
bun format

# 2. Lint
bun lint

# 3. Type check
npx tsc --noEmit

# 4. Unit tests
bun test

# 5. E2E smoke tests (optional but recommended)
bun test:e2e:smoke
```

**Git hooks automate**:
- Pre-commit: Format staged files
- Pre-push: Format check + lint

---

## CI/CD Testing

### GitHub Actions

**Unit tests** (on every push):
```yaml
- name: Test shared package
  run: bun --filter shared test

- name: Test client package
  run: bun --filter client test

- name: Test contracts
  run: bun --filter contracts test
```

**E2E tests** (on main/develop push):
```yaml
- name: Run E2E smoke tests
  run: |
    bun dev &
    sleep 30
    bun test:e2e:smoke
```

### Coverage Enforcement

CI fails if coverage drops below:
- Client: 70% overall, 80% critical paths
- Admin: 70% overall
- Shared: 80% overall
- Contracts: 80% testnet, 100% mainnet

---

## Platform-Specific Testing

### Desktop (Admin)

**Automated**:
- ✅ Chromium browser tests (Playwright)
- ✅ Wallet connect simulation (storage injection)
- ✅ Garden/action management flows

**Manual QA**:
- Real wallet connect (MetaMask)
- Transaction signing
- Multi-chain testing

### Mobile (Client PWA)

**Automated**:
- ✅ Android Chrome (Pixel 5 emulation, passkey testing)
- ✅ iOS Safari (iPhone 13 emulation, wallet testing)
- ✅ Responsive design validation
- ✅ PWA manifest loading

**Manual QA (Real Devices)**:
- Real biometric authentication (Touch ID, Face ID, fingerprint)
- PWA install flow (Add to Home Screen)
- Offline mode (airplane mode)
- Background sync
- Camera permissions
- Service worker updates

### When to Run Manual QA

- Before production deploys
- After auth changes
- After PWA manifest changes
- When mobile bugs reported
- Major releases

---

## Test Patterns

### Unit Tests (Vitest)

```typescript
// ✅ Good - focused, fast
describe('formatDate', () => {
  it('formats timestamp correctly', () => {
    const result = formatDate(1704067200);
    expect(result).toBe('Jan 1, 2024');
  });
});
```

### Component Tests

```typescript
// ✅ Good - test user behavior, not implementation
it('shows error when form is invalid', async () => {
  const { user } = render(<GardenForm />);
  
  await user.click(screen.getByText('Submit'));
  
  expect(screen.getByText('Name is required')).toBeVisible();
});
```

### Hook Tests

```typescript
// ✅ Good - test hook behavior with proper wrapper
import { renderHook } from '@testing-library/react';

it('fetches gardens for current chain', async () => {
  const { result } = renderHook(() => useGardens(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
  });
  
  await waitFor(() => {
    expect(result.current.gardens).toHaveLength(3);
  });
});
```

### E2E Tests (Playwright)

```typescript
// ✅ Good - test complete user journey
test("gardener can submit work", async ({ page }) => {
  const helper = new ClientTestHelper(page);
  await helper.setupPasskeyAuth();
  await helper.createPasskeyAccount("gardener1");
  
  // Navigate to garden
  await page.click('[data-testid="garden-card"]');
  
  // Submit work
  await page.click('button:has-text("Log Work")');
  await page.fill('textarea', 'Planted 10 trees');
  await page.click('button:has-text("Submit")');
  
  // Verify success
  await expect(page.locator('text=Work submitted')).toBeVisible();
});
```

---

## Mock Strategies

### Vitest Mocks

```typescript
// Mock external services
vi.mock('@green-goods/shared/modules/data/ipfs', () => ({
  uploadToIPFS: vi.fn(() => Promise.resolve('ipfs://mock-hash')),
}));

// Mock viem client
vi.mock('viem', () => ({
  ...vi.importActual('viem'),
  createWalletClient: vi.fn(() => mockWalletClient),
}));
```

### Playwright Mocks

```typescript
// Mock API responses
await page.route('**/v1/graphql', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ data: { Garden: mockGardens } }),
  });
});

// Mock wallet state (storage injection)
await helper.injectWalletAuth("0xTestAddress");
```

---

## Troubleshooting Tests

### Flaky Tests

**Symptoms**: Tests pass sometimes, fail others

**Common causes**:
- Race conditions (missing `waitFor`)
- Timeout too short
- Network-dependent assertions
- Uncleared state between tests

**Solutions**:
```typescript
// ❌ Bad - race condition
await button.click();
expect(result).toBeVisible();

// ✅ Good - wait for condition
await button.click();
await waitFor(() => expect(result).toBeVisible());
```

### E2E Test Failures

**Service not running:**
```bash
# Check services
bun tests/run-tests.ts check

# Start services
bun dev
```

**Auth not working:**
```typescript
// For passkey tests - only works on Chromium
test.skip(testInfo.project.name === "mobile-safari", "iOS doesn't support virtual WebAuthn");

// For iOS - use wallet injection
await helper.injectWalletAuth();
```

**Timeout errors:**
- Increase timeout in `playwright.config.ts`
- Check if services are actually running
- Use `page.waitForLoadState('networkidle')`

### Contract Test Failures

**Revert errors:**
```bash
# Run with verbose output
forge test -vvvv --match-test testFailingTest
```

**Gas limit exceeded:**
```bash
# Check gas usage
forge test --gas-report
```

---

## Coverage Reports

### Generate Reports

```bash
# Client/Admin/Shared
bun --filter client coverage
# Opens coverage/index.html

# Contracts
forge coverage
forge coverage --report summary
```

### Interpreting Coverage

**Threshold meanings**:
- **70%+** = Acceptable for non-critical code
- **80%+** = Required for core logic, shared code
- **100%** = Required for security-critical paths, mainnet contracts

**What to focus on**:
- ✅ Authentication flows (100%)
- ✅ Payment/transaction flows (100%)
- ✅ Data encryption (100%)
- ⚠️ UI components (70%+ sufficient)
- ⚠️ Simple utilities (70%+ sufficient)

---

## Test Data Management

### Factories

```typescript
// Create consistent test data
export const createMockGarden = (overrides = {}): Garden => ({
  id: "84532-1",
  chainId: 84532,
  name: "Test Garden",
  description: "Test description",
  ...overrides,
});
```

### Cleanup

```typescript
// Clean up after each test
afterEach(() => {
  // Clear stores
  useWorkFlowStore.getState().reset();
  
  // Clear query cache
  queryClient.clear();
  
  // Clear IndexedDB (for offline tests)
  await jobQueueDB.clearAll();
});
```

---

## Performance Testing

### Lighthouse CI (Automated)

Lighthouse CI runs automatically on all PRs that affect the client, admin, or shared packages. It tests performance, accessibility, best practices, and SEO.

**Run locally:**

```bash
# Test client (builds + runs Lighthouse)
bun lighthouse:client

# Test admin
bun lighthouse:admin

# Test both
bun lighthouse

# Collect results only (no assertions)
bun lighthouse:collect
```

**Performance Budgets:**

| Metric | Target | Notes |
|--------|--------|-------|
| Performance Score | 90+ | Overall Lighthouse performance |
| Accessibility Score | 100 | WCAG compliance |
| Best Practices | 95+ | Security, HTTPS, modern APIs |
| SEO | 90+ | Meta tags, semantic HTML |
| Total Blocking Time | < 300ms | Main thread blocking time |
| Cumulative Layout Shift | < 0.1 | Visual stability |
| Largest Contentful Paint | < 2.5s | Largest element render time |
| First Contentful Paint | < 2s | First paint time |
| Time to Interactive | < 3.8s | Full interactivity time |

**Configuration:**

- Client config: `packages/client/.lighthouserc.json`
- Admin config: `packages/admin/.lighthouserc.json`
- CI workflow: `.github/workflows/lighthouse-ci.yml`

**Viewing Results:**

Results are uploaded to temporary public storage and linked in PR comments. You can also view local results:

```bash
# After running locally (from package directory)
cd packages/client && npx lhci open
```

### Lighthouse (Manual - Advanced)

For custom Lighthouse audits beyond CI:

```bash
# Build production
bun --filter client build

# Serve
bunx serve packages/client/dist

# Run Lighthouse with custom config
npx lighthouse http://localhost:3000 --view \
  --preset=desktop \
  --throttling.rttMs=40 \
  --throttling.throughputKbps=10240

# Mobile simulation
npx lighthouse http://localhost:3000 --view \
  --preset=perf \
  --throttling-method=simulate
```

### Performance Profiling

Use Chrome DevTools for detailed performance analysis:

```bash
# Start dev server
bun dev

# Open Chrome DevTools Performance tab
# Record page load and interactions
# Look for:
# - Long tasks (> 50ms)
# - Network waterfalls
# - Memory leaks
# - Layout thrashing
```

### Load Testing (Future)

For API/indexer load testing:
```bash
# k6 or Artillery for GraphQL load tests
# Test query performance under load
```

---

## Accessibility Testing

### Automated (in E2E)

```typescript
// Check basic a11y
test("has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  
  // Run axe-core checks
  const violations = await page.evaluate(() => {
    return window.axe.run();
  });
  
  expect(violations.violations).toHaveLength(0);
});
```

### Manual Checks

- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Screen reader compatibility (VoiceOver, TalkBack)
- ✅ Color contrast (WCAG AA)
- ✅ Focus indicators
- ✅ ARIA labels

---

## Hypercerts Testing

Testing patterns specific to the Hypercert minting feature.

### XState Machine Testing

Test the `mintHypercertMachine` state transitions:

```typescript
import { createActor, fromPromise } from 'xstate';
import { mintHypercertMachine } from '@green-goods/shared';

describe('mintHypercertMachine', () => {
  it('starts in idle state', () => {
    const actor = createActor(mintHypercertMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('transitions to uploadingMetadata on START_MINT', () => {
    const actor = createActor(mintHypercertMachine);
    actor.start();

    actor.send({ type: 'START_MINT', input: createMockMintInput() });
    expect(actor.getSnapshot().value).toBe('uploadingMetadata');
    actor.stop();
  });

  it('retries from last successful state', async () => {
    let uploadCount = 0;

    const actor = createActor(
      mintHypercertMachine.provide({
        actors: {
          uploadMetadata: fromPromise(async () => ({ cid: 'QmMeta' })),
          uploadAllowlist: fromPromise(async () => {
            uploadCount++;
            if (uploadCount === 1) throw new Error('First attempt failed');
            return { cid: 'QmAllow', merkleRoot: '0x...' };
          }),
        },
      })
    );
    actor.start();

    actor.send({ type: 'START_MINT', input: createMockMintInput() });
    await waitFor(() => expect(actor.getSnapshot().value).toBe('failed'));

    // Retry preserves metadata CID, retries only failed step
    actor.send({ type: 'RETRY' });
    await waitFor(() => expect(actor.getSnapshot().value).toBe('signing'));
    expect(actor.getSnapshot().context.metadataCid).toBe('QmMeta');
    actor.stop();
  });
});
```

### Distribution Logic Testing

```typescript
import { calculateDistribution, buildContributorWeights, TOTAL_UNITS } from '@green-goods/shared';

describe('calculateDistribution', () => {
  it('distributes equally among contributors', () => {
    const attestations = [
      createMockHypercertAttestation({ gardenerAddress: '0x111' }),
      createMockHypercertAttestation({ gardenerAddress: '0x222' }),
      createMockHypercertAttestation({ gardenerAddress: '0x333' }),
    ];

    const result = calculateDistribution(attestations, 'equal');
    expect(result.length).toBe(3);

    // Total equals TOTAL_UNITS (100_000_000n)
    const total = result.reduce((sum, e) => sum + e.units, 0n);
    expect(total).toBe(TOTAL_UNITS);
  });

  it('weights by contribution count', () => {
    const attestations = [
      createMockHypercertAttestation({ gardenerAddress: '0x111' }),
      createMockHypercertAttestation({ gardenerAddress: '0x111' }),
      createMockHypercertAttestation({ gardenerAddress: '0x222' }),
    ];

    const weights = buildContributorWeights(attestations);
    const result = calculateDistribution(attestations, 'weighted', weights);

    const addr1Entry = result.find(e => e.address === '0x111');
    const addr2Entry = result.find(e => e.address === '0x222');

    // 0x111 has 2 contributions, 0x222 has 1
    expect(addr1Entry!.units).toBe(addr2Entry!.units * 2n);
  });
});
```

### Mock Factories

```typescript
import {
  createMockHypercertDraft,
  createMockHypercertAttestation,
  createMockAllowlistEntry,
} from '@green-goods/shared/__tests__/test-utils';

const draft = createMockHypercertDraft({
  gardenId: 'test-garden',
  title: 'Test Hypercert',
  attestationIds: ['att-1', 'att-2'],
});

const attestations = [
  createMockHypercertAttestation({ id: 'att-1', title: 'Work 1' }),
  createMockHypercertAttestation({ id: 'att-2', title: 'Work 2' }),
];

const allowlist = [
  createMockAllowlistEntry({ address: '0x123...', units: 50_000_000n }),
  createMockAllowlistEntry({ address: '0x456...', units: 50_000_000n }),
];
```

### Running Hypercert Tests

```bash
# Run all hypercert tests
bun test packages/shared -- hypercert

# Run specific test file
bun test packages/shared/src/__tests__/workflows/mintHypercertMachine.test.ts

# With coverage
bun test packages/shared -- hypercert --coverage
```

---

## Complete Testing Documentation

**Package-specific context**:
- Client: `.claude/context/client.md`
- Admin: `.claude/context/admin.md`
- Shared: `.claude/context/shared.md`
- Contracts: `.claude/context/contracts.md`
- Agent: `.claude/context/agent.md`
- Indexer: `.claude/context/indexer.md`

**E2E testing**:
- Quick reference: [`../../tests/README.md`](https://github.com/greenpill-dev-guild/green-goods/tree/main/tests#readme)
- Architecture: [`../../tests/ARCHITECTURE.md`](https://github.com/greenpill-dev-guild/green-goods/tree/main/tests/ARCHITECTURE)

**CI/CD**:
- GitHub Actions: `.github/workflows/`
- Quality standards: `CLAUDE.md`