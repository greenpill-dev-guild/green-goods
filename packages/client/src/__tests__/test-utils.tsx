/**
 * Test Utilities for Client Package
 *
 * Re-exports shared test utilities with client-specific additions.
 */

// Re-export everything from shared testing utilities
export {
  createMockSmartAccountClient,
  MOCK_ADDRESSES,
  MOCK_TX_HASH,
  mock,
  QueryTestWrapper as TestWrapper,
  renderWithQuery as renderWithProviders,
} from "@green-goods/shared/__tests__/test-utils";
export { createTestQueryClient } from "@green-goods/shared/__tests__/test-utils/query-client";

// Re-export testing library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

// Client-specific: Re-export render as renderWithProviders for backward compatibility
import { renderWithQuery } from "@green-goods/shared/__tests__/test-utils";
export const render = renderWithQuery;
