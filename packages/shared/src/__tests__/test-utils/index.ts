/**
 * Test Utilities
 *
 * Provides helper functions and wrappers for testing React hooks and components.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, type RenderHookOptions } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import enMessages from "../../i18n/en.json";

// Re-export mock factories and offline helpers
export * from "./mock-factories";
export * from "./offline-helpers";

// ============================================
// Query Client Factory
// ============================================

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ============================================
// Test Wrapper Components
// ============================================

interface WrapperProps {
  children: ReactNode;
}

/**
 * Creates a wrapper with QueryClientProvider and IntlProvider
 */
export function createTestWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();

  return function TestWrapper({ children }: WrapperProps) {
    return createElement(
      QueryClientProvider,
      { client },
      createElement(IntlProvider, { locale: "en", messages: enMessages }, children)
    );
  };
}

/**
 * Creates a wrapper with only IntlProvider (for hooks that don't need React Query)
 */
export function createIntlWrapper() {
  return function IntlWrapper({ children }: WrapperProps) {
    return createElement(IntlProvider, { locale: "en", messages: enMessages }, children);
  };
}

// ============================================
// Enhanced renderHook
// ============================================

interface RenderHookWithProvidersOptions<TProps>
  extends Omit<RenderHookOptions<TProps>, "wrapper"> {
  queryClient?: QueryClient;
}

/**
 * Renders a hook with QueryClientProvider and IntlProvider wrappers
 */
export function renderHookWithProviders<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options: RenderHookWithProvidersOptions<TProps> = {}
) {
  const { queryClient, ...restOptions } = options;
  const wrapper = createTestWrapper(queryClient);

  return renderHook(hook, { wrapper, ...restOptions });
}

// ============================================
// Mock Navigator Helpers
// ============================================

export function setNavigatorOnline(isOnline: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: isOnline,
    writable: true,
  });
}

export function mockNavigatorCredentials() {
  const mockCredentials = {
    create: vi.fn(),
    get: vi.fn(),
  };

  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: mockCredentials,
    writable: true,
  });

  return mockCredentials;
}

// ============================================
// Async Helpers
// ============================================

/**
 * Waits for a condition to be true, with timeout
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error("Condition not met within timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Flushes all pending promises
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ============================================
// Mock Helper (Replaces vi.mocked)
// ============================================

/**
 * Mock method interface for vitest mock functions.
 * Uses unknown for values that depend on the mocked function's signature.
 */
interface MockMethods<T> {
  mockResolvedValue: (
    value: T extends (...args: unknown[]) => Promise<infer R> ? R : unknown
  ) => void;
  mockRejectedValue: (value: unknown) => void;
  mockReturnValue: (value: T extends (...args: unknown[]) => infer R ? R : unknown) => void;
  mockImplementation: (
    fn: T extends (...args: infer A) => infer R ? (...args: A) => R : never
  ) => void;
  mockClear: () => void;
  mockReset: () => void;
}

/**
 * Type-safe mock helper to replace vi.mocked()
 *
 * Usage:
 *   mock(myFunction).mockResolvedValue(...)
 *   mock(myObject.method).mockReturnValue(...)
 *
 * This helper provides compatibility across Vitest versions
 * by providing typed mock methods.
 */
export function mock<T>(fn: T): T & MockMethods<T> {
  return fn as T & MockMethods<T>;
}

// ============================================
// Alternative Render Methods
// ============================================

/**
 * Wrapper component that provides QueryClient and IntlProvider
 * Used by renderWithQuery for component testing
 */
export function QueryTestWrapper({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(IntlProvider, { locale: "en", messages: enMessages }, children)
  );
}

/**
 * Renders a component with QueryClientProvider and IntlProvider
 * Standard render for component tests that may use react-intl
 */
export function renderWithQuery(
  ui: React.ReactElement,
  options?: Omit<import("@testing-library/react").RenderOptions, "wrapper">
) {
  const { render } = require("@testing-library/react");
  return render(ui, { wrapper: QueryTestWrapper, ...options });
}

// Import vi for mock utilities
import { vi } from "vitest";
import type React from "react";

// Re-export testing library for convenience
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
