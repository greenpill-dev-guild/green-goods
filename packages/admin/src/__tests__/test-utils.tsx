/**
 * Test Utilities for Admin Package
 *
 * Re-exports shared test utilities with admin-specific additions.
 */

// Re-export everything from shared testing utilities
export {
  createMockSmartAccountClient,
  createTestQueryClient,
  MOCK_ADDRESSES,
  MOCK_TX_HASH,
  mock,
  QueryTestWrapper as TestWrapper,
  renderWithQuery as renderWithProviders,
} from "@green-goods/shared/testing";

// Re-export testing library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

// Admin-specific: Re-export render as renderWithProviders for backward compatibility
import { renderWithQuery } from "@green-goods/shared/testing";
export const render = renderWithQuery;
