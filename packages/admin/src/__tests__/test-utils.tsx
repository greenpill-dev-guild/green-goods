/**
 * Test Utilities for Admin Package
 *
 * Re-exports shared test utilities with admin-specific additions.
 */

import { getTestQueryClient } from "@green-goods/shared/__tests__/test-utils/query-client";
import enMessages from "@green-goods/shared/i18n/en.json";
import { QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "react-intl";
import { render as renderTestingLibrary } from "@testing-library/react";
import type { ReactNode } from "react";

// Re-export testing library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

function onIntlError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "MISSING_TRANSLATION"
  ) {
    return;
  }
  throw error;
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = getTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={enMessages} onError={onIntlError}>
        {children}
      </IntlProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactNode) {
  return renderTestingLibrary(ui, { wrapper: Providers });
}

export const render = renderWithProviders;
