/**
 * Canvas Tests
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";
import { Canvas, useCanvasPortal } from "../../components/Cockpit/Canvas";

function OverlayActivator({ active }: { active: boolean }) {
  const { portalTarget, setOverlayActive } = useCanvasPortal();

  useEffect(() => {
    setOverlayActive("test-overlay", active);
    return () => setOverlayActive("test-overlay", false);
  }, [active, setOverlayActive]);

  return <div data-testid="portal-state">{portalTarget ? "ready" : "missing"}</div>;
}

describe("Canvas", () => {
  it("exposes the bounded overlay root through context and an external ref", async () => {
    function Harness() {
      const overlayRef = useRef<HTMLDivElement | null>(null);

      return (
        <>
          <Canvas isReceded={false} overlayRef={overlayRef}>
            <OverlayActivator active={false} />
          </Canvas>
          <div data-testid="ref-state">{overlayRef.current ? "ready" : "missing"}</div>
        </>
      );
    }

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId("portal-state")).toHaveTextContent("ready");
      expect(screen.getByTestId("canvas-overlay-root")).toBeInTheDocument();
    });
  });

  it("recedes the canvas content when the shell marks it as receded", () => {
    render(
      <Canvas isReceded={true}>
        <div>Content</div>
      </Canvas>
    );

    expect(screen.getByTestId("canvas-content")).toHaveStyle({
      transform: "scale(var(--canvas-scale-receded))",
    });
  });

  it("uses the shared cockpit frame class for pane margins", () => {
    render(
      <Canvas isReceded={false}>
        <div>Content</div>
      </Canvas>
    );

    expect(screen.getByTestId("canvas").className).toContain("cockpit-canvas-frame");
  });

  it("recedes the canvas content when a bounded overlay is active", async () => {
    render(
      <Canvas isReceded={false}>
        <OverlayActivator active={true} />
      </Canvas>
    );

    await waitFor(() => {
      expect(screen.getByTestId("canvas-content")).toHaveStyle({
        transform: "scale(var(--canvas-scale-receded))",
      });
    });
  });
});
