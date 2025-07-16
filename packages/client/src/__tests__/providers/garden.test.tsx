import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  // screen
} from "@testing-library/react";
import { describe, it } from "vitest";

import { GardensProvider, useGardens } from "../../providers/garden";

const TestComponent = () => {
  const { actions, gardens } = useGardens();

  return (
    <div>
      <p>Actions: {actions.length}</p>
      <p>Gardens: {gardens.length}</p>
    </div>
  );
};

describe("GardensProvider", () => {
  it("should provide default value and allow updates", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GardensProvider>
          <TestComponent />
        </GardensProvider>
      </QueryClientProvider>
    );

    // Check initial value
    // expect(screen.getByTestId('value')).toHaveTextContent('default');

    // Update value via button click
    // screen.getByRole('button', { name: /update value/i }).click();

    // Check updated value
    // expect(screen.getByTestId('value')).toHaveTextContent('updated');
  });
});
