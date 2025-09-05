import React from "react";

// Create simplified mock providers for component testing
export const MockUserProvider = ({ children, userRole = "admin" }: { 
  children: React.ReactNode; 
  userRole?: "admin" | "operator" | "unauthorized";
}) => {
  const addressMap = {
    admin: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
    operator: "0x04D60647836bcA09c37B379550038BdaaFD82503",
    unauthorized: "0x1234567890123456789012345678901234567890",
  };

  // Mock user context (unused but kept for future implementation)

  return React.createElement("div", { "data-testid": "mock-user-provider" }, children);
};

export const MockUrqlProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement("div", { "data-testid": "mock-urql-provider" }, children);
};

export const MockSubscriptionsProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement("div", { "data-testid": "mock-subscriptions-provider" }, children);
};
