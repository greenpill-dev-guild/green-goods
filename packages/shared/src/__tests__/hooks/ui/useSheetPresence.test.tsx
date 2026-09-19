/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSheetPresence } from "../../../hooks/ui/useSheetPresence";
import { useUIStore } from "../../../stores/useUIStore";

beforeEach(() => {
  useUIStore.setState({ openSheetCount: 0 });
});

describe("useSheetPresence", () => {
  it("counts a sheet only while it is open", () => {
    const view = renderHook(({ open }) => useSheetPresence(open), {
      initialProps: { open: false },
    });
    expect(useUIStore.getState().openSheetCount).toBe(0);

    view.rerender({ open: true });
    expect(useUIStore.getState().openSheetCount).toBe(1);

    view.rerender({ open: false });
    expect(useUIStore.getState().openSheetCount).toBe(0);
  });

  it("keeps overlapping sheets counted until the last one closes", () => {
    const first = renderHook(() => useSheetPresence(true));
    const second = renderHook(() => useSheetPresence(true));
    expect(useUIStore.getState().isAnySheetOpen()).toBe(true);

    first.unmount();
    expect(useUIStore.getState().openSheetCount).toBe(1);

    second.unmount();
    expect(useUIStore.getState().isAnySheetOpen()).toBe(false);
  });

  it("stays balanced under StrictMode's double effects", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const view = renderHook(() => useSheetPresence(true), { wrapper });
    expect(useUIStore.getState().openSheetCount).toBe(1);

    view.unmount();
    expect(useUIStore.getState().openSheetCount).toBe(0);
  });
});
