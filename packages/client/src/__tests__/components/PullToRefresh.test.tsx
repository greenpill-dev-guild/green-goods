/** @vitest-environment jsdom */

import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PullToRefresh } from "@/components/Inputs/PullToRefresh";
import { renderWithProviders, screen, waitFor } from "../test-utils";

describe("PullToRefresh", () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="app-scroll"></main>';
  });

  it("refreshes after a downward pull crosses the threshold", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <PullToRefresh onRefresh={onRefresh}>
        <p>Garden activity</p>
      </PullToRefresh>
    );
    const surface = container.firstElementChild!;

    fireEvent.touchStart(surface, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(surface, { touches: [{ clientY: 250 }] });
    expect(screen.getByRole("status")).toHaveAccessibleName("Release to refresh");
    fireEvent.touchEnd(surface);

    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveAccessibleName("Pull to refresh");
  });

  it("ignores pulls while disabled or below a scrolled container", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const scroll = document.getElementById("app-scroll")!;
    scroll.scrollTop = 20;
    const { container, rerender } = renderWithProviders(
      <PullToRefresh onRefresh={onRefresh}>
        <p>Garden activity</p>
      </PullToRefresh>
    );
    const surface = container.firstElementChild!;
    fireEvent.touchStart(surface, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(surface, { touches: [{ clientY: 250 }] });
    fireEvent.touchEnd(surface);
    expect(onRefresh).not.toHaveBeenCalled();

    scroll.scrollTop = 0;
    rerender(
      <PullToRefresh onRefresh={onRefresh} disabled>
        <p>Garden activity</p>
      </PullToRefresh>
    );
    fireEvent.touchStart(surface, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(surface, { touches: [{ clientY: 250 }] });
    fireEvent.touchEnd(surface);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
