import { useCallback, useEffect, useState } from "react";
import { useEventListener } from "../../hooks/utils/useEventListener";

function isEditableElement(element: Element | null) {
  return (
    element instanceof HTMLElement &&
    (element.matches("input, textarea, select") || element.isContentEditable)
  );
}

export function useCanvasMobileChromeHidden() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [editableFocused, setEditableFocused] = useState(false);
  const viewport = typeof window !== "undefined" ? window.visualViewport : null;

  const updateKeyboardState = useCallback(() => {
    if (typeof window === "undefined") return;

    const visualViewportOpen = viewport ? viewport.height < window.innerHeight * 0.78 : false;
    const resizedWindowOpen = window.innerHeight < window.screen.height * 0.74;
    setKeyboardOpen(visualViewportOpen || resizedWindowOpen);
  }, [viewport]);

  const updateEditableFocus = useCallback(() => {
    if (typeof document === "undefined") return;
    setEditableFocused(isEditableElement(document.activeElement));
  }, []);

  useEffect(() => {
    updateKeyboardState();
  }, [updateKeyboardState]);

  useEffect(() => {
    updateEditableFocus();
  }, [updateEditableFocus]);

  useEventListener(viewport, "resize" as never, updateKeyboardState);
  useEventListener(
    typeof window !== "undefined" ? window : null,
    "resize" as never,
    updateKeyboardState
  );
  useEventListener(
    typeof document !== "undefined" ? document : null,
    "focusin" as never,
    updateEditableFocus
  );
  useEventListener(
    typeof document !== "undefined" ? document : null,
    "focusout" as never,
    updateEditableFocus
  );

  return keyboardOpen || editableFocused;
}
