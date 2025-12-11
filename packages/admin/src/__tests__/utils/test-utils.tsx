import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  userRole?: "admin" | "operator" | "unauthorized";
  initialEntries?: string[];
}

// Create a fresh QueryClient for each test
function createTestQueryClient() {
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

// Create a test wrapper component
function createTestWrapper({ initialEntries = ["/"] }: Omit<CustomRenderOptions, "userRole">) {
  const queryClient = createTestQueryClient();

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

// Custom render function with providers
export function renderWithProviders(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { userRole = "admin", initialEntries, ...renderOptions } = options;

  const Wrapper = createTestWrapper({ initialEntries });

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    userRole,
  };
}

// Re-export everything from React Testing Library
export * from "@testing-library/react";
export { renderWithProviders as render };
