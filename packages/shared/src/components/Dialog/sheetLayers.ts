/**
 * Page layers behind open sheets: which branches of the page are hidden from
 * assistive tech, and which open sheet is on top. Module scope, so every
 * `PwaSheet` shares one ledger and one stack.
 *
 * @module components/Dialog/sheetLayers
 */

/**
 * Branches currently hidden from assistive tech by open sheets, with how
 * many sheets hold each one and the attribute value to restore. Module
 * scope so overlapping sheets share one ledger.
 */
const hiddenBranches = new Map<Element, { count: number; previous: string | null }>();

/**
 * Hide every sibling along `target`'s ancestor path up to <body>, the way
 * Radix hides the rest of the page behind a dialog. Works for portaled and
 * inline sheets alike: only the sheet's own ancestors stay exposed. Returns
 * the release function; a branch is restored once its last holder releases.
 */
export function hideOthers(target: Element): () => void {
  const held: Element[] = [];
  let node: Element | null = target;
  while (node && node !== document.body && node.parentElement) {
    const parent: Element = node.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || sibling.tagName === "SCRIPT" || sibling.tagName === "STYLE") continue;
      const entry = hiddenBranches.get(sibling);
      if (entry) {
        entry.count += 1;
      } else {
        hiddenBranches.set(sibling, { count: 1, previous: sibling.getAttribute("aria-hidden") });
        sibling.setAttribute("aria-hidden", "true");
      }
      held.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const sibling of held) {
      const entry = hiddenBranches.get(sibling);
      if (!entry) continue;
      entry.count -= 1;
      if (entry.count > 0) continue;
      hiddenBranches.delete(sibling);
      if (entry.previous === null) sibling.removeAttribute("aria-hidden");
      else sibling.setAttribute("aria-hidden", entry.previous);
    }
  };
}

/** Sheets open right now, in the order they opened. */
const openSheets: symbol[] = [];

/**
 * Register an open sheet on top of the stack. Only the topmost sheet answers
 * Escape, so a confirmation stacked on a sheet closes alone; `close` takes the
 * sheet off the stack wherever it sits.
 */
export function openSheetLayer(): { isTopmost: () => boolean; close: () => void } {
  const token = Symbol("sheet");
  openSheets.push(token);
  return {
    isTopmost: () => openSheets[openSheets.length - 1] === token,
    close: () => {
      const index = openSheets.lastIndexOf(token);
      if (index !== -1) openSheets.splice(index, 1);
    },
  };
}
