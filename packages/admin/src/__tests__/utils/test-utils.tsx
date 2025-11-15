import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { Provider as UrqlProvider } from "urql";
import { PrivyProvider } from "@privy-io/react-auth";
import { UserProvider } from "@/providers/user";
import { SubscriptionsProvider } from "@/providers/subscriptions";
import { createMockUrqlClient } from "./urql-mock";
import { createMockPrivyUser } from "../mocks/privy";

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  userRole?: "admin" | "operator" | "unauthorized";
  _initialEntries?: string[];
  urqlClient?: unknown;
}

// Create a test wrapper component
function createTestWrapper({
  userRole = "admin",
  _initialEntries = ["/"],
  urqlClient,
}: Omit<CustomRenderOptions, "userRole"> & { userRole: "admin" | "operator" | "unauthorized" }) {
  const _mockUser = createMockPrivyUser(userRole);
  const client = urqlClient || createMockUrqlClient();

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <PrivyProvider appId="test-app-id">
        <UrqlProvider value={client}>
          <UserProvider>
            <SubscriptionsProvider>
              <BrowserRouter>{children}</BrowserRouter>
            </SubscriptionsProvider>
          </UserProvider>
        </UrqlProvider>
      </PrivyProvider>
    );
  };
}

// Custom render function with providers
export function renderWithProviders(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { userRole = "admin", _initialEntries, urqlClient, ...renderOptions } = options;

  const Wrapper = createTestWrapper({ userRole, _initialEntries, urqlClient });

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    // Return useful test utilities
    mockUser: createMockPrivyUser(userRole),
  };
}

// Re-export everything from React Testing Library
export * from "@testing-library/react";
export { renderWithProviders as render };
