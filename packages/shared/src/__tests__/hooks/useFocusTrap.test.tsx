import { render, screen, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useFocusTrap } from "../../hooks/utils/useFocusTrap";

function Dialog() {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, { autoFocusSelector: null });
  return (
    <div ref={ref}>
      <button>Close</button>
      <button>Photo</button>
      <input type="hidden" />
      <div style={{ display: "none" }}>
        <button>Hidden</button>
      </div>
      <button disabled>Disabled</button>
      <button tabIndex={-1}>Scrim</button>
      <a href="#source">Source</a>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("owns middle Tab steps so engines cannot skip restored photo buttons", () => {
    render(<Dialog />);
    const photo = screen.getByRole("button", { name: "Photo" });
    photo.focus();
    expect(fireEvent.keyDown(photo, { key: "Tab" })).toBe(false);
    expect(screen.getByRole("link", { name: "Source" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(photo).toHaveFocus();
  });
});
