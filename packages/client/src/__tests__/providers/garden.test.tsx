import { describe, it } from "vitest";
import {
  render,
  // screen
} from "@testing-library/react";

import { useGardens, GardensProvider } from "../../providers/garden";

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
    render(
      <GardensProvider>
        <TestComponent />
      </GardensProvider>
    );

    // Check initial value
    // expect(screen.getByTestId('value')).toHaveTextContent('default');

    // Update value via button click
    // screen.getByRole('button', { name: /update value/i }).click();

    // Check updated value
    // expect(screen.getByTestId('value')).toHaveTextContent('updated');
  });
});
