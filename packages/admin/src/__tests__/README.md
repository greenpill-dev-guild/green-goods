# Green Goods Admin Dashboard Testing

This directory contains comprehensive test suites for the Admin Dashboard package.

## Test Structure

```
src/test/
├── hooks/                 # Hook unit tests
│   ├── useRole.test.ts
│   ├── useChainSync.test.ts
│   ├── useToastAction.test.ts
│   └── useGardenOperations.test.ts
├── components/            # Component unit tests
│   ├── RequireAuth.test.tsx
│   └── RequireRole.test.tsx
├── views/                 # View component tests
│   └── Gardens.test.tsx
├── workflows/             # Workflow and state machine tests
│   ├── createGarden.test.ts
│   └── unauthorized-actions.test.tsx
├── integration/           # End-to-end integration tests
│   ├── foundry-setup.ts
│   ├── garden-lifecycle.test.ts
│   └── end-to-end.test.ts
├── mocks/                 # Mock implementations
│   ├── server.ts          # MSW GraphQL mocks
│   ├── privy.ts           # Privy authentication mocks
│   ├── viem.ts            # Blockchain interaction mocks
│   └── index.ts           # Centralized mock exports
├── utils/                 # Test utilities
│   ├── test-utils.tsx     # Custom render with providers
│   └── urql-mock.ts       # URQL client mocking
├── setup.ts               # Global test setup
└── README.md              # This file
```

## Running Tests

### Unit Tests (Fast)
```bash
pnpm test:unit
```
Runs all unit tests excluding integration tests. Uses mocks for all external dependencies.

### Integration Tests (Slow)
```bash
pnpm test:integration
```
Runs integration tests against Base Sepolia testnet. Requires:
- `VITE_BASE_SEPOLIA_RPC` environment variable
- `TEST_PRIVATE_KEY` for test account with Sepolia ETH
- Foundry installed for contract deployment

### All Tests
```bash
pnpm test
```
Runs both unit and integration tests.

### Watch Mode
```bash
pnpm test:watch
```
Runs tests in watch mode for development.

### Coverage Report
```bash
pnpm test:coverage
```
Generates test coverage report.

## Test Configuration

### Environment Variables
- **Unit Tests**: Use `.env.test` with mock values
- **Integration Tests**: Require real Base Sepolia RPC and test private key

### Mocking Strategy
- **Privy**: Mock authentication states (admin, operator, unauthorized)
- **URQL**: Mock GraphQL queries with MSW
- **Viem**: Mock blockchain interactions and contract calls
- **Toast**: Mock notification system

## Key Test Scenarios

### Authentication & Authorization
- ✅ Role detection (admin, operator, unauthorized)
- ✅ Route protection based on roles
- ✅ Unauthorized access handling

### Garden Management
- ✅ Garden listing (admin sees all, operator sees assigned)
- ✅ Garden creation workflow
- ✅ Gardener add/remove operations
- ✅ Error handling and toast notifications

### Blockchain Integration
- ✅ Contract interaction mocking
- ✅ Transaction success/failure handling
- ✅ Gas estimation validation
- ✅ Chain switching functionality

### State Management
- ✅ XState workflow testing
- ✅ Store synchronization
- ✅ Loading states

## CI/CD Integration

The test suite is designed to run in CI environments:

- **Unit tests** run on every PR for fast feedback
- **Integration tests** run optionally with proper environment setup
- **Coverage reports** are generated for code quality metrics

## Debugging Tests

### Common Issues
1. **Mock not working**: Check import order and mock setup in `setup.ts`
2. **Integration test failing**: Verify Base Sepolia RPC and test account funding
3. **Component not rendering**: Ensure all required providers are wrapped in test utils

### Debug Commands
```bash
# Run specific test file
pnpm test useRole.test.ts

# Run with verbose output
pnpm test --reporter=verbose

# Run with UI (browser-based test runner)
pnpm test:ui
```

## Adding New Tests

1. **Unit Tests**: Add to appropriate directory (`hooks/`, `components/`, `views/`)
2. **Integration Tests**: Add to `integration/` directory
3. **Mocks**: Update mocks in `mocks/` directory as needed
4. **Utilities**: Add shared test utilities to `utils/`

Follow the existing patterns and ensure comprehensive coverage of success and error scenarios.
