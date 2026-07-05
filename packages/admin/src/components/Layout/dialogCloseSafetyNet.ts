/**
 * Safety net for the "page frozen until refresh" dialog lockup.
 *
 * Radix Dialog locks `body { pointer-events: none }` while a modal is open and
 * clears it when the exit animation completes. Two situations break that
 * contract: an action dialog that closes by navigating away can unmount
 * mid-close, and a hidden tab freezes CSS animations so `animationend` never
 * fires — either way the lock (and sometimes the exit node) outlives the
 * dialog and the whole admin goes click-dead.
 *
 * This runs after navigation, on visibilitychange, and is safe to call any
 * time: it does nothing while any dialog is legitimately open.
 */
export function releaseStuckDialogArtifacts(doc: Document = document): void {
  const modalOpen = doc.querySelector(
    '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]'
  );
  if (modalOpen) return;

  if (doc.body.style.pointerEvents === "none") {
    doc.body.style.pointerEvents = "";
  }

  // A dialog whose exit animation froze (hidden tab) still sits in the DOM in
  // its closed state. Marking it instant-exit removes its animation (the CSS
  // also display:none's it), so Radix's presence tracking can resolve and the
  // ghost never blocks or flashes.
  for (const node of doc.querySelectorAll(
    '[data-component="AdminDialog"][data-state="closed"]:not([data-instant-exit]),[data-component="AdminSideSheet"][data-state="closed"]:not([data-instant-exit])'
  )) {
    node.setAttribute("data-instant-exit", "");
  }
}
