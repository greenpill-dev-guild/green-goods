import { describe, expect, it, vi } from "vitest";

import { PublicSurfaceState } from "../../components/Public/PublicSurfaceState";
import { fireEvent, renderWithProviders, screen } from "../test-utils";

const slots = {
  loading: <p>Loading</p>,
  error: <p>Unavailable</p>,
  empty: <p>Nothing yet</p>,
  children: <p>Ready records</p>,
};

describe("PublicSurfaceState", () => {
  it.each([
    ["error", "Unavailable", "alert"],
    ["empty", "Nothing yet", "status"],
  ] as const)("renders the %s slot with its semantic role", (state, copy, role) => {
    renderWithProviders(<PublicSurfaceState state={state} {...slots} />);
    expect(screen.getByRole(role)).toHaveTextContent(copy);
    expect(screen.queryByText("Ready records")).not.toBeInTheDocument();
  });

  it("says a failed read is unavailable and asks it again, unless the surface replaces that", () => {
    const { error: _replaced, ...standard } = slots;
    const onRetry = vi.fn();
    const { rerender } = renderWithProviders(
      <PublicSurfaceState state="error" onRetry={onRetry} {...standard} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This public record is temporarily unavailable. Please try again."
    );
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <PublicSurfaceState
        state="error"
        onRetry={onRetry}
        errorMessage="Evidence is temporarily unavailable."
        {...standard}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Evidence is temporarily unavailable.");
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("reserves the loading layout without announcing an interstitial status", () => {
    const { container } = renderWithProviders(<PublicSurfaceState state="loading" {...slots} />);
    const loading = container.querySelector("[data-public-surface-state='loading']");

    expect(loading).toHaveTextContent("Loading");
    expect(screen.getByText("Loading...")).toHaveClass("sr-only");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(loading).not.toHaveAttribute("role");
    expect(loading).not.toHaveAttribute("aria-live");
  });

  it("renders ready children without an extra landmark", () => {
    const { container } = renderWithProviders(<PublicSurfaceState state="ready" {...slots} />);
    expect(screen.getByText("Ready records")).toBeInTheDocument();
    expect(container.querySelector("[data-public-surface-state]")).toBeNull();
  });

  it("supports a definition-list value container", () => {
    const { container } = renderWithProviders(
      <dl>
        <dt>Backed so far</dt>
        <PublicSurfaceState state="loading" container="dd" {...slots} />
      </dl>
    );

    expect(container.querySelector("dl > dd[aria-busy='true']")).toHaveTextContent("Loading");
    expect(container.querySelector("dl > dd")).not.toHaveAttribute("role");
  });
});
