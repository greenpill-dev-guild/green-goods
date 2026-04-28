import type { Garden } from "@green-goods/shared";
import { useEffect } from "react";

interface CommandPaletteShortcutsOptions {
  eligibleGardens: Garden[];
  open: boolean;
  selectGarden: (garden: Garden) => void;
  setOpen: (open: boolean) => void;
}

function isTypingTarget(element: HTMLElement | null): boolean {
  if (!element) return false;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)) return true;
  return element.isContentEditable;
}

export function useCommandPaletteShortcuts({
  eligibleGardens,
  open,
  selectGarden,
  setOpen,
}: CommandPaletteShortcutsOptions) {
  useEffect(() => {
    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(!open);
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;

      const digit = Number.parseInt(event.key, 10);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
      if (isTypingTarget(document.activeElement as HTMLElement | null)) return;

      const targetGarden = eligibleGardens[digit - 1];
      if (!targetGarden) return;

      event.preventDefault();
      selectGarden(targetGarden);
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [eligibleGardens, open, selectGarden, setOpen]);
}
