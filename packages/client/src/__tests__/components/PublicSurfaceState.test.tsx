import { describe, expect, it } from "vitest";

import { PublicSurfaceState } from "../../components/Public/PublicSurfaceState";
import { renderWithProviders, screen } from "../test-utils";

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
