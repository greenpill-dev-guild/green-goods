import { describe, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { useGarden, GardenProvider } from "../../providers/garden";

const TestComponent = () => {
  const { actions, gardeners, gardens } = useGarden();

  return (
    <div>
      <p>Actions: {actions.length}</p>
      <p>Gardeners: {gardeners.length}</p>
      <p>Gardens: {gardens.length}</p>
    </div>
  );
};

describe("GardenProvider", () => {
  it("should provide default value and allow updates", () => {
    render(
      <GardenProvider>
        <TestComponent />
      </GardenProvider>
    );

    // Check initial value
    // expect(screen.getByTestId('value')).toHaveTextContent('default');

    // Update value via button click
    // screen.getByRole('button', { name: /update value/i }).click();

    // Check updated value
    // expect(screen.getByTestId('value')).toHaveTextContent('updated');
  });
});
