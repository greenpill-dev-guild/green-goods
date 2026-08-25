import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicSurfaceState } from "../../components/Public/PublicSurfaceState";

const slots = {
  loading: <p>Loading</p>,
  error: <p>Unavailable</p>,
  empty: <p>Nothing yet</p>,
  children: <p>Ready records</p>,
};

describe("PublicSurfaceState", () => {
  it.each([
    ["loading", "Loading", "status"],
    ["error", "Unavailable", "alert"],
    ["empty", "Nothing yet", "status"],
  ] as const)("renders the %s slot with its semantic role", (state, copy, role) => {
    render(<PublicSurfaceState state={state} {...slots} />);
    expect(screen.getByRole(role)).toHaveTextContent(copy);
    expect(screen.queryByText("Ready records")).not.toBeInTheDocument();
  });

  it("renders ready children without an extra landmark", () => {
    const { container } = render(<PublicSurfaceState state="ready" {...slots} />);
    expect(screen.getByText("Ready records")).toBeInTheDocument();
    expect(container.querySelector("[data-public-surface-state]")).toBeNull();
  });

  it("supports a definition-list value container", () => {
    const { container } = render(
      <dl>
        <dt>Backed so far</dt>
        <PublicSurfaceState state="loading" container="dd" {...slots} />
      </dl>
    );

    expect(container.querySelector("dl > dd[role='status']")).toHaveTextContent("Loading");
  });
});
