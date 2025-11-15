# Testing & QA

Comprehensive testing strategy across all Green Goods packages.

---

## Testing Overview

| Package | Framework | Coverage Target | Command |
|---------|-----------|----------------|---------|
| **Client** | Vitest + Testing Library | 70%+ (80%+ critical) | `bun --filter client test` |
| **Admin** | Vitest + Testing Library | 70%+ | `bun --filter admin test` |
| **Indexer** | (Integration) | N/A | Manual verification |
| **Contracts** | Foundry | 80%+ (100% mainnet) | `bun --filter contracts test` |

---

## Running Tests

### All Tests

```bash
bun test
```

### Package-Specific

```bash
bun --filter client test
bun --filter admin test
bun --filter contracts test
```

### Watch Mode

```bash
bun --filter client test:watch
```

### Coverage

```bash
bun --filter client coverage
forge coverage  # Contracts
```

---

## Client Testing

**Test Categories**:
- Component tests
- Hook tests
- Module/service tests
- Integration tests

**Example**:
```typescript
describe('JobQueue', () => {
  it('adds job and processes when online', async () => {
    const queue = new JobQueue();
    await queue.addJob({ type: 'work', data: {...} });
    expect(queue.getStats().pending).toBe(1);
  });
});
```

**Key Tests**:
- Offline queue processing
- Authentication flows
- Work submission
- Attestation creation

---

## Admin Testing

**Focus**: Integration tests for workflows

```typescript
it('admin can create garden and add members', async () => {
  const { user } = renderWithProviders(<App />, { userRole: 'admin' });
  
  await user.click(screen.getByText('Create Garden'));
  await user.type(screen.getByLabelText('Name'), 'Test Garden');
  await user.click(screen.getByText('Submit'));
  
  expect(screen.getByText('Test Garden')).toBeInTheDocument();
});
```

---

## Contract Testing

**Foundry Tests**:

```bash
forge test                      # All tests
forge test --match-test testGarden  # Specific
forge test -vvv                 # Verbose
forge test --gas-report         # Gas analysis
```

**Test Categories**:
- Unit tests (individual functions)
- Integration tests (cross-contract)
- Fork tests (against live networks)
- Gas optimization tests
- Upgrade safety tests

**Example**:
```solidity
function testGardenToken_mintsNewGarden() public {
    vm.prank(admin);
    uint256 tokenId = gardenToken.mintGarden(
        owner, "Test", "metadata", gardeners, operators
    );
    assertEq(tokenId, 1);
}
```

---

## E2E Testing

**Playwright** (via MCP):
- Full user journeys
- Cross-package flows
- Visual regression
- Accessibility audits

---

## Complete Testing Docs

**📖 Package details**:
- Client: `packages/client/.cursor/rules/testing.mdc`
- Admin: `packages/admin/.cursor/rules/testing.mdc`
- Contracts: `packages/contracts/.cursor/rules/testing-conventions.mdc`

