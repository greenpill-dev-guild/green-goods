# Offline Optimization Test Suite

This comprehensive test suite covers all the offline optimization features for the Green Goods client application. The tests are designed to validate feature development using Test-Driven Development (TDD) principles.

## 📁 Test Structure

```
src/__tests__/
├── modules/                    # Core business logic tests
│   ├── retry-policy.test.ts   # Smart retry system tests
│   ├── deduplication.test.ts  # Content deduplication tests
│   ├── storage-manager.test.ts # Storage management tests
│   └── conflict-resolver.test.ts # Conflict resolution tests
├── components/                 # UI component tests
│   ├── OfflineIndicator.enhanced.test.tsx # Enhanced offline indicator
│   └── OfflineWorkDashboard.test.tsx (planned)
├── integration/               # End-to-end workflow tests
│   ├── offline-workflow.test.ts # Complete offline workflows
│   └── conflict-resolution.test.ts (planned)
├── setupTests.ts             # Test environment setup
└── README.md                 # This file

src/__mocks__/                 # Mock implementations
├── indexeddb.ts              # IndexedDB API mocks
├── navigator.ts              # Navigator API mocks
└── crypto.ts                 # Crypto API mocks

src/test-utils/               # Test utilities and helpers
└── offline-test-helpers.ts   # Offline-specific test utilities
```

## 🧪 Test Categories

### **Module Tests (Unit)**
- **Retry Policy Tests**: Exponential backoff, jitter, max attempts, time calculations
- **Deduplication Tests**: Content hashing, local/remote duplicate detection, edge cases
- **Storage Manager Tests**: Quota management, cleanup policies, storage analytics
- **Conflict Resolver Tests**: Conflict detection, resolution strategies, API interactions

### **Component Tests (Integration)**
- **Enhanced Offline Indicator**: State management, user interactions, visual feedback
- **Offline Work Dashboard**: Work management, retry operations, storage details

### **Integration Tests (E2E)**
- **Complete Offline Workflows**: Offline→Online transitions, data integrity
- **Error Handling**: Network failures, API errors, recovery scenarios
- **Performance**: Large batch operations, concurrent sync, timing

## 🔧 Mock Architecture

### **IndexedDB Mocks**
- Complete IndexedDB API simulation
- Object stores, indexes, transactions
- Data persistence across test operations

### **Network Mocks** 
- Fetch API mocking with configurable responses
- Network condition simulation (offline/online/slow)
- API error scenarios

### **Browser API Mocks**
- Navigator.onLine status simulation
- Storage API quota estimation
- Crypto operations for content hashing

## 🎯 Coverage Goals

- **Unit Tests**: >90% coverage
- **Integration Tests**: >85% coverage  
- **Component Tests**: >80% coverage

## 🏃‍♂️ Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm coverage

# Run specific test files
pnpm test retry-policy
pnpm test offline-workflow
pnpm test OfflineIndicator

# Run tests by pattern
pnpm test --grep "deduplication"
pnpm test --grep "conflict"
```

## 📊 Test Scenarios Covered

### **Happy Path Scenarios**
- ✅ Offline work creation and storage
- ✅ Successful sync when back online
- ✅ Content-based deduplication  
- ✅ Storage cleanup operations
- ✅ Conflict resolution workflows

### **Error Scenarios**
- ✅ Network interruptions during sync
- ✅ API failures and retries
- ✅ Storage quota exceeded
- ✅ Schema version conflicts
- ✅ Concurrent operation handling

### **Edge Cases**
- ✅ Very large data objects
- ✅ Unicode content handling
- ✅ Rapid state changes
- ✅ Browser compatibility issues
- ✅ Performance under load

## 🔄 Test Data Factories

The test suite includes factories for creating realistic test data:

- `createMockOfflineWork()` - Generate work items with configurable properties
- `createMockConflict()` - Generate conflict scenarios
- `createMockFile()` - Generate file objects for image testing
- `createTestWorkData()` - Generate realistic work submission data
- `createTestApprovalData()` - Generate approval workflow data

## 🛠️ Debugging Tests

### **Useful Debug Techniques**
```typescript
// Enable verbose logging in tests
process.env.NODE_ENV = 'test';
console.log = vi.fn(); // Mock to capture logs

// Inspect test state
expect(mockOfflineDB.storage).toMatchSnapshot();

// Time-based debugging
vi.useFakeTimers();
vi.advanceTimersByTime(1000);

// Network condition debugging
simulateNetworkConditions.slow();
simulateNetworkConditions.offline();
```

### **Common Issues**
- **Async timing**: Use `waitFor()` for async operations
- **Mock state**: Clear mocks between tests with `resetAllMocks()`
- **Network simulation**: Reset navigator.onLine in afterEach
- **Memory leaks**: Clean up IndexedDB mock storage

## 📈 Metrics and Assertions

### **Performance Metrics**
- Sync operation timing
- Storage operation efficiency  
- Memory usage patterns
- Concurrent operation handling

### **Quality Metrics**
- Code coverage percentages
- Test execution time
- Mock coverage validation
- Error scenario coverage

## 🔮 Future Test Enhancements

### **Planned Additions**
- Visual regression testing for UI components
- E2E tests with Playwright for full browser testing
- Performance benchmarking with realistic data volumes
- Accessibility testing for offline features
- Mobile-specific testing scenarios

### **Advanced Scenarios**
- Multi-device synchronization testing
- Cross-browser compatibility validation
- Real IndexedDB testing (in addition to mocks)
- Service Worker integration testing
- PWA offline behavior validation

## 📝 Test Maintenance

### **Adding New Tests**
1. Create test file in appropriate category folder
2. Use existing test helpers and mocks
3. Follow TDD: Write failing test → Implement feature → Verify passing
4. Update coverage thresholds if needed

### **Updating Existing Tests**
1. Run affected tests before changes
2. Update test data factories if interfaces change
3. Verify mock compatibility with real implementations
4. Update documentation for significant changes

This test suite provides comprehensive coverage for all offline optimization features and ensures robust, reliable functionality for users working in challenging network conditions. 