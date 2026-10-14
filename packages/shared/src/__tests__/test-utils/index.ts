/**
 * Test Utilities
 *
 * Re-exports every test-utils leaf and Testing Library for Admin and Client
 * (`@green-goods/shared/testing`). Shared tests import the leaf modules directly, which keeps each
 * test file from loading every fixture; test-quality rejects new barrel imports in Shared tests.
 */

export { createTestQueryClient, resetTestQueryClient } from "./query-client";
export { renderHookWithQueryClient } from "./query-client-render";
// Re-export mock factories, offline helpers, and centralized barrel mock
export * from "./mock-factories";
export * from "./offline-helpers";
export * from "./transaction-fakes";
export * from "./job-queue-fakes";
export * from "./commitment-pooling-fixtures";
export * from "./controller-fixtures";
export { describeConformance, type ConformanceLaw } from "./conformance";
export { createSharedBarrelMock } from "./shared-barrel-mock";
export * from "./render-helpers";

// Re-export testing library for convenience
export * from "@testing-library/react";
