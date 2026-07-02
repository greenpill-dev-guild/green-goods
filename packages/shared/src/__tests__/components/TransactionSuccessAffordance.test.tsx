/**
 * TransactionSuccessAffordance tests
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSuccess = vi.fn();

vi.mock("../../components/Toast/toast.service", () => ({
  toastService: {
    success: (...args: unknown[]) => mockSuccess(...args),
  },
}));

import { TransactionSuccessAffordance } from "../../components/feedback/TransactionSuccessAffordance";

describe("TransactionSuccessAffordance", () => {
  beforeEach(() => {
    mockSuccess.mockClear();
  });

  it("screen mode renders children in a polite status region when shown", () => {
    render(
      <TransactionSuccessAffordance mode="screen" show title="Endowed">
        <p>Endowed 1 WETH to Garden</p>
      </TransactionSuccessAffordance>
    );
    const region = screen.getByRole("status", { name: "Endowed" });
    expect(region).toHaveTextContent("Endowed 1 WETH to Garden");
    expect(region).toHaveAttribute("data-mode", "screen");
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it("renders nothing while not shown", () => {
    const { container } = render(
      <TransactionSuccessAffordance mode="screen" show={false}>
        <p>hidden</p>
      </TransactionSuccessAffordance>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("toast mode fires the service exactly once per success", () => {
    const { rerender, container } = render(
      <TransactionSuccessAffordance mode="toast" show={false} title="Claimed" message="Done." />
    );
    expect(mockSuccess).not.toHaveBeenCalled();

    rerender(<TransactionSuccessAffordance mode="toast" show title="Claimed" message="Done." />);
    expect(mockSuccess).toHaveBeenCalledTimes(1);
    expect(mockSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Claimed", message: "Done." })
    );
    expect(container).toBeEmptyDOMElement();

    // Re-render while still successful: no re-toast.
    rerender(<TransactionSuccessAffordance mode="toast" show title="Claimed" message="Done." />);
    expect(mockSuccess).toHaveBeenCalledTimes(1);

    // Reset then succeed again: a fresh toast.
    rerender(
      <TransactionSuccessAffordance mode="toast" show={false} title="Claimed" message="Done." />
    );
    rerender(<TransactionSuccessAffordance mode="toast" show title="Claimed" message="Done." />);
    expect(mockSuccess).toHaveBeenCalledTimes(2);
  });

  it("none mode renders nothing even when shown", () => {
    const { container } = render(
      <TransactionSuccessAffordance mode="none" show>
        <p>hidden</p>
      </TransactionSuccessAffordance>
    );
    expect(container).toBeEmptyDOMElement();
    expect(mockSuccess).not.toHaveBeenCalled();
  });
});
