/**
 * Test Utilities
 *
 * Provides helper functions and wrappers for testing React hooks and components.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, type RenderHookOptions } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";

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
      createElement(IntlProvider, { locale: "en", messages: {} }, children)
    );
  };
}

/**
 * Creates a wrapper with only IntlProvider (for hooks that don't need React Query)
 */
export function createIntlWrapper() {
  return function IntlWrapper({ children }: WrapperProps) {
    return createElement(IntlProvider, { locale: "en", messages: {} }, children);
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

// Import vi for mock utilities
import { vi } from "vitest";
