# Integration Testing Strategy

This document outlines the path forward for robust integration testing with real blockchain data.

## Current Testing Architecture

### Test Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        E2E Tests (Playwright)                    │
│  • UI flows with wallet injection                                │
│  • Service health checks                                         │
│  • Navigation & routing                                          │
├─────────────────────────────────────────────────────────────────┤
│                    Integration Tests (Vitest)                    │
│  • Auth flows with mocked Pimlico                                │
│  • GraphQL queries with MSW                                      │
│  • Smart contract interactions (mocked)                          │
├─────────────────────────────────────────────────────────────────┤
│                      Unit Tests (Vitest)                         │
│  • Pure functions                                                │
│  • React hooks (isolated)                                        │
│  • State machine transitions                                     │
├─────────────────────────────────────────────────────────────────┤
│                   Contract Tests (Foundry)                       │
│  • Solidity unit tests                                           │
│  • Fuzz tests                                                    │
│  • Fork tests against live networks                              │
└─────────────────────────────────────────────────────────────────┘
```

### Current Limitations

1. **Passkey E2E Tests**: Skipped because virtual WebAuthn authenticators create credentials that real Pimlico servers reject (no valid cryptographic signatures)

2. **Blockchain Interaction**: E2E tests use wallet injection without actual blockchain transactions

3. **Indexer Data**: Tests depend on whatever data exists in the local indexer

## Path Forward: Robust Integration Testing

### Phase 1: Local Blockchain Fork Testing

Use Anvil (Foundry) to fork Base Sepolia for deterministic testing:

```bash
# Start Anvil fork of Base Sepolia
anvil --fork-url https://sepolia.base.org --fork-block-number 12345678
```

**Benefits:**
- Deterministic state (same block = same data)
- Real contract interactions without gas costs
- Can manipulate time, balances, and state
- Tests against actual deployed contracts

**Implementation:**

```typescript
// tests/fixtures/blockchain.ts
import { createTestClient, http, publicActions, walletActions } from 'viem';
import { foundry } from 'viem/chains';

export async function setupLocalFork() {
  const client = createTestClient({
    chain: foundry,
    mode: 'anvil',
    transport: http('http://127.0.0.1:8545'),
  })
    .extend(publicActions)
    .extend(walletActions);

  // Impersonate accounts, set balances, etc.
  await client.setBalance({
    address: TEST_WALLET_ADDRESS,
    value: parseEther('10'),
  });

  return client;
}
```

### Phase 2: Testnet Integration Tests

Create a dedicated test suite that runs against Base Sepolia:

```typescript
// tests/integration/testnet.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Testnet Integration', () => {
  test.skip(process.env.CI === 'true', 'Testnet tests run manually');

  test('can join garden on testnet', async ({ page }) => {
    // Use a funded test wallet
    const testWallet = process.env.TEST_WALLET_PRIVATE_KEY;

    // Inject real wallet connection
    await injectTestWallet(page, testWallet);

    // Perform real transaction
    await page.goto('/home');
    await page.click('[data-testid="join-garden"]');

    // Wait for transaction confirmation
    await expect(page.locator('[data-testid="tx-success"]'))
      .toBeVisible({ timeout: 60000 });
  });
});
```

### Phase 3: Passkey Testing Strategy

Since we can't use virtual authenticators with real Pimlico:

#### Option A: Pimlico Sandbox/Test Mode

Contact Pimlico about a test mode that accepts virtual authenticator credentials:

```typescript
// Hypothetical test mode
const passkeyClient = createPasskeyServerClient(chainId, {
  testMode: process.env.CI === 'true',
});
```

#### Option B: Mock Pimlico in E2E Tests

Add MSW handlers for browser-based Pimlico mocking:

```typescript
// tests/mocks/pimlico-handlers.ts
import { http, HttpResponse } from 'msw';

export const pimlicoHandlers = [
  http.post('https://api.pimlico.io/v2/*/rpc', async ({ request }) => {
    const body = await request.json();

    if (body.method === 'pks_startRegistration') {
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: mockRegistrationOptions,
      });
    }

    if (body.method === 'pks_verifyRegistration') {
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { success: true, id: 'mock-id', publicKey: '0x...' },
      });
    }

    // ... other handlers
  }),
];
```

#### Option C: Dedicated Passkey Test Environment

Run a local mock Pimlico server for testing:

```typescript
// scripts/mock-pimlico-server.ts
import express from 'express';

const app = express();

app.post('/v2/:chainId/rpc', (req, res) => {
  // Accept any attestation, return mock responses
});

app.listen(3333);
```

Then configure tests to use `http://localhost:3333` as Pimlico URL.

### Phase 4: Comprehensive Test Data Management

#### Seed Data Script

```typescript
// scripts/seed-test-data.ts
import { createGarden, joinGarden, submitWork } from './test-helpers';

async function seedTestData(client: TestClient) {
  // Create test gardens
  const garden1 = await createGarden(client, {
    name: 'E2E Test Garden',
    operators: [TEST_OPERATOR],
  });

  // Add test gardeners
  await joinGarden(client, garden1, TEST_GARDENER_1);
  await joinGarden(client, garden1, TEST_GARDENER_2);

  // Create test work submissions
  await submitWork(client, garden1, TEST_GARDENER_1, {
    title: 'Test Work Item',
    actionUID: TEST_ACTION_UID,
  });

  return { garden1 };
}
```

#### Test Database Snapshots

For Envio indexer, create database snapshots:

```bash
# Create snapshot after seeding
pg_dump -Fc indexer_db > tests/fixtures/seeded-db.dump

# Restore before tests
pg_restore -d indexer_db tests/fixtures/seeded-db.dump
```

## Recommended Test Matrix

| Test Type | Environment | Auth Method | Blockchain | CI |
|-----------|-------------|-------------|------------|-----|
| Unit | Node | Mocked | None | ✅ |
| Integration | Node | Mocked Pimlico | Mocked | ✅ |
| E2E Smoke | Browser | Wallet Injection | None | ✅ |
| E2E Fork | Browser | Wallet Injection | Anvil Fork | ✅ |
| E2E Testnet | Browser | Real Wallet | Base Sepolia | Manual |
| E2E Passkey | Browser | Mock Pimlico | Anvil Fork | ✅ |

## Implementation Checklist

### Short Term (1-2 weeks)
- [x] Skip passkey e2e tests that hit real Pimlico
- [x] Add timeout handling to Pimlico calls
- [ ] Add MSW browser handlers for Pimlico mocking
- [ ] Create Anvil fork test fixture

### Medium Term (2-4 weeks)
- [ ] Implement seed data scripts
- [ ] Add database snapshot/restore for indexer
- [ ] Create testnet integration test suite (manual run)
- [ ] Document test wallet management

### Long Term (1-2 months)
- [ ] Contact Pimlico about test mode
- [ ] Build local Pimlico mock server
- [ ] Full passkey e2e coverage with mocked server
- [ ] Automated testnet integration in CI (scheduled)

## Environment Configuration

```bash
# .env.test
VITE_CHAIN_ID=31337                    # Anvil local
ANVIL_FORK_URL=https://sepolia.base.org
ANVIL_FORK_BLOCK=12345678

# Test wallets (DO NOT use in production)
TEST_OPERATOR_PK=0x...
TEST_GARDENER_PK=0x...

# Pimlico (use mock in CI)
VITE_PIMLICO_API_KEY=test
MOCK_PIMLICO_SERVER=http://localhost:3333
```

## Running Tests

```bash
# Unit + Integration tests
bun test

# E2E smoke tests (wallet injection only)
bun test:e2e:smoke

# E2E with local fork
bun test:e2e:fork

# Manual testnet integration
TESTNET=true bun test:e2e:testnet
```
