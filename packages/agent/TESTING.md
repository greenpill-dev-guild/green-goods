# Agent Package Testing Guide

## Overview

The agent package uses Vitest for testing with the following test categories:

1. **Unit Tests** - Test individual functions and modules in isolation
2. **Integration Tests** - Test interactions with real dependencies
3. **E2E Tests** - Test complete bot flows end-to-end
4. **Performance Tests** - Benchmark critical operations

## Running Tests

```bash
# Run all tests
bun test

# Run specific test suites
bun test:unit          # Fast, isolated tests
bun test:integration   # Tests with real dependencies
bun test:e2e          # Full bot flow tests
bun test:perf         # Performance benchmarks

# Watch mode for development
bun test:watch

# Coverage report
bun test:coverage
```

## Test Structure

```
tests/
├── unit/              # Isolated unit tests
├── integration/       # Integration tests
├── e2e/              # End-to-end tests
├── performance/      # Performance benchmarks
├── fixtures/         # Test data files
├── utils/            # Test utilities
│   ├── factories.ts  # Test data builders
│   ├── mocks.ts      # Mock implementations
│   └── helpers.ts    # Test helpers
└── setup/            # Test configuration
```

## Writing Tests

### Unit Tests

Unit tests should be fast and isolated:

```typescript
import { describe, it, expect } from 'vitest';
import { encryptPrivateKey } from '@/services/crypto';

describe('Crypto Service', () => {
  it('should encrypt private keys', () => {
    const key = '0x' + 'a'.repeat(64);
    const encrypted = encryptPrivateKey(key);
    
    expect(encrypted.version).toBe(1);
    expect(encrypted.ciphertext).toBeDefined();
  });
});
```

### Integration Tests

Integration tests use real dependencies:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createAnvil } from '@viem/anvil';
import { submitWork } from '@/services/blockchain';

describe('Blockchain Integration', () => {
  let anvil: any;
  
  beforeAll(async () => {
    anvil = createAnvil({ port: 8545 });
    await anvil.start();
  });
  
  it('should submit work on-chain', async () => {
    const tx = await submitWork(account, workData);
    expect(tx).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
```

### Using Test Factories

```typescript
import { MessageBuilder, createMockUser } from '../utils/factories';

it('should handle user commands', async () => {
  const message = new MessageBuilder()
    .withCommand('start')
    .fromUser('test-user-123')
    .build();
    
  const user = createMockUser({ role: 'operator' });
  
  const result = await handleMessage(message, user);
  expect(result.response.text).toContain('Welcome');
});
```

## Mocking Guidelines

### What to Mock

✅ **Mock these:**
- External APIs (Telegram, PostHog)
- Network requests
- File system operations (in unit tests)
- Time-based operations

❌ **Don't mock these:**
- Crypto operations
- Database queries (use test DB)
- Business logic
- Viem (use test chain)

### Mock Examples

```typescript
// Good: Mock external service
vi.mock('telegraf', () => ({
  Telegraf: vi.fn(() => mockTelegramBot),
}));

// Bad: Don't mock internal logic
// vi.mock('./services/crypto'); // ❌ Don't do this
```

## Test Patterns

### Testing Async Operations

```typescript
it('should handle async work submission', async () => {
  const result = await submitWork(data);
  
  // Wait for side effects
  await vi.waitFor(() => {
    expect(mockBot.sendMessage).toHaveBeenCalled();
  });
});
```

### Testing Error Scenarios

```typescript
it('should handle network failures gracefully', async () => {
  vi.spyOn(global, 'fetch').mockRejectedValue(
    new Error('Network error')
  );
  
  const result = await handleMessage(message);
  expect(result.response.text).toContain('try again');
});
```

### Testing Rate Limits

```typescript
it('should enforce rate limits', async () => {
  const limiter = new RateLimiter();
  
  // Exhaust limit
  for (let i = 0; i < 10; i++) {
    limiter.check('user', 'action');
  }
  
  const result = limiter.check('user', 'action');
  expect(result.allowed).toBe(false);
});
```

## Performance Testing

```typescript
import { bench } from 'vitest';

bench('encrypt private key', () => {
  encryptPrivateKey('0x' + 'a'.repeat(64));
});

it('should complete under 10ms', () => {
  const start = performance.now();
  performOperation();
  const duration = performance.now() - start;
  
  expect(duration).toBeLessThan(10);
});
```

## Coverage Requirements

- **Unit Tests**: 80% coverage minimum
- **Critical Paths**: 100% coverage (auth, crypto, payments)
- **Integration Tests**: Focus on happy paths and error cases
- **E2E Tests**: Cover main user journeys

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pre-commit hooks (unit tests only)
- Main branch commits (full suite)

## Debugging Tests

```bash
# Run tests with UI
bun test:ui

# Run specific test file
bun test tests/unit/crypto.test.ts

# Run tests matching pattern
bun test -t "should encrypt"

# Debug in VS Code
# Add breakpoint and press F5
```

## Best Practices

1. **Test Names**: Use descriptive names that explain the scenario
2. **Isolation**: Each test should be independent
3. **Clarity**: Tests document expected behavior
4. **Speed**: Keep unit tests under 50ms
5. **Reliability**: No flaky tests - use `vi.waitFor()` for async
6. **Maintenance**: Update tests when changing functionality

## Common Issues

### Module Resolution
If you see `Cannot find module`:
1. Check tsconfig paths
2. Ensure dependencies are installed
3. Clear Vitest cache: `rm -rf node_modules/.vitest`

### Timeout Issues
For slow operations:
```typescript
it('slow operation', async () => {
  // Increase timeout for this test
  await doSlowOperation();
}, { timeout: 10000 });
```

### Memory Leaks
Run with memory profiling:
```bash
NODE_OPTIONS="--expose-gc" bun test:memory
```