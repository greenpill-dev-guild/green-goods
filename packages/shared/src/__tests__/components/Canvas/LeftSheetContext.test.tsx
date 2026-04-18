// packages/shared/src/__tests__/components/Canvas/LeftSheetContext.test.tsx
import { act, render, renderHook } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";
import { describe, it, expect } from "vitest";
import {
  LeftSheetProvider,
  useLeftSheetConfig,
  useLeftSheetConfigValue,
  type LeftSheetConfig,
} from "../../../components/Canvas/LeftSheetContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <LeftSheetProvider>{children}</LeftSheetProvider>
);

describe("useLeftSheetConfig", () => {
  it("publishes the passed config to provider consumers", () => {
    const config: LeftSheetConfig = {
      title: "Review Work",
      content: <div data-testid="content">body</div>,
      onClose: () => {},
    };

    const { result } = renderHook(
      () => {
        useLeftSheetConfig(config);
        return useLeftSheetConfigValue();
      },
      { wrapper }
    );

    expect(result.current).toEqual(config);
  });

  it("does not cascade re-renders when the same config reference is passed across renders", () => {
    const config: LeftSheetConfig = {
      title: "Stable",
      content: <div>body</div>,
      onClose: () => {},
    };

    let providerRenderCount = 0;

    function Consumer({ value }: { value: LeftSheetConfig | null }) {
      useLeftSheetConfig(value);
      // Sentinel read so the provider value is subscribed to.
      useLeftSheetConfigValue();
      return null;
    }

    function RenderCounter() {
      // Read from provider so re-renders reflect provider updates.
      useLeftSheetConfigValue();
      const renderRef = useRef(0);
      renderRef.current += 1;
      providerRenderCount = renderRef.current;
      return null;
    }

    const { rerender } = render(
      <LeftSheetProvider>
        <Consumer value={config} />
        <RenderCounter />
      </LeftSheetProvider>
    );

    const initialRenders = providerRenderCount;

    // Re-render with the SAME config reference 5 times.
    for (let i = 0; i < 5; i++) {
      rerender(
        <LeftSheetProvider>
          <Consumer value={config} />
          <RenderCounter />
        </LeftSheetProvider>
      );
    }

    // Parent rerenders force the counter to re-render, but the provider's
    // internal state must NOT churn — i.e. no infinite update loop.
    // A bounded number of renders (<= initial + parent rerenders) is the
    // signal. If the buggy two-effect shape came back, this would explode.
    expect(providerRenderCount).toBeLessThanOrEqual(initialRenders + 5 + 1);
  });

  it("clears the config when null is passed", () => {
    const config: LeftSheetConfig = {
      title: "First",
      content: <div>one</div>,
      onClose: () => {},
    };

    const { result, rerender } = renderHook(
      ({ value }: { value: LeftSheetConfig | null }) => {
        useLeftSheetConfig(value);
        return useLeftSheetConfigValue();
      },
      { wrapper, initialProps: { value: config as LeftSheetConfig | null } }
    );

    expect(result.current).toEqual(config);

    rerender({ value: null });

    expect(result.current).toBeNull();
  });

  it("clears the config when the consumer unmounts", () => {
    const config: LeftSheetConfig = {
      title: "Mounted",
      content: <div>body</div>,
      onClose: () => {},
    };

    let readConfig: LeftSheetConfig | null = null;

    function Consumer() {
      useLeftSheetConfig(config);
      return null;
    }

    function Reader() {
      readConfig = useLeftSheetConfigValue();
      return null;
    }

    const { rerender } = render(
      <LeftSheetProvider>
        <Consumer />
        <Reader />
      </LeftSheetProvider>
    );

    expect(readConfig).toEqual(config);

    // Unmount the consumer but keep the provider + reader alive.
    rerender(
      <LeftSheetProvider>
        <Reader />
      </LeftSheetProvider>
    );

    expect(readConfig).toBeNull();
  });

  it("switches provider config once per distinct value", () => {
    const first: LeftSheetConfig = {
      title: "First",
      content: <div>one</div>,
      onClose: () => {},
    };
    const second: LeftSheetConfig = {
      title: "Second",
      content: <div>two</div>,
      onClose: () => {},
    };

    const snapshots: Array<LeftSheetConfig | null> = [];

    function Consumer({ value }: { value: LeftSheetConfig | null }) {
      useLeftSheetConfig(value);
      return null;
    }

    function Reader() {
      const value = useLeftSheetConfigValue();
      // Capture each provider-driven render
      useEffect(() => {
        snapshots.push(value);
      }, [value]);
      return null;
    }

    const { rerender } = render(
      <LeftSheetProvider>
        <Consumer value={first} />
        <Reader />
      </LeftSheetProvider>
    );

    act(() => {
      rerender(
        <LeftSheetProvider>
          <Consumer value={second} />
          <Reader />
        </LeftSheetProvider>
      );
    });

    // Expected observable sequence: initial null -> first -> second.
    // Each distinct value shows up exactly once.
    expect(snapshots.filter((s) => s?.title === "First")).toHaveLength(1);
    expect(snapshots.filter((s) => s?.title === "Second")).toHaveLength(1);
  });
});
