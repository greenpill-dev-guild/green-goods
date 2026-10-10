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

  const view = doc.defaultView;
  if (!view) return;

  let hasRunningExit = false;
  for (const node of doc.querySelectorAll<HTMLElement>(
    '[data-component="AdminDialog"][data-state="closed"],[data-component="AdminSideSheet"][data-state="closed"]'
  )) {
    if (
      node
        .getAnimations?.()
        .some((animation) => animation.pending || animation.playState === "running")
    ) {
      hasRunningExit = true;
      continue;
    }

    // Finish Presence's lifecycle instead of cancelling CSS through a DOM
    // attribute mutation. React then unmounts the portal and releases focus,
    // aria-hidden, and pointer locks together.
    const names = view.getComputedStyle(node).animationName || "none";
    for (const animationName of names.split(",").map((name) => name.trim())) {
      node.dispatchEvent(new view.AnimationEvent("animationend", { animationName }));
    }
  }

  if (!hasRunningExit && doc.body.style.pointerEvents === "none") {
    doc.body.style.pointerEvents = "";
  }
}
