import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

import {expandedIdMap, rewriteIdReferences} from "./diagramIds";

// Every mermaid diagram gets a visible Expand control that opens a full-screen
// overlay with zoom and pan. Attachment is a plain DOM decoration (no
// measurement, no IntersectionObserver), so it works no matter when or where
// mermaid finishes rendering.
const CONTAINER_SELECTOR = ".docusaurus-mermaid-container";
const TRIGGER_CLASS = "gg-diagram-expand";
const SCALE_MIN = 0.25;
const SCALE_MAX = 8;
const SCALE_STEP = 1.25;
// A press that moves less than this is a click, not a drag.
const DRAG_THRESHOLD_PX = 4;

let observer: MutationObserver | null = null;
// Only one overlay is open at a time; navigation closes it.
let closeActiveOverlay: ((restoreFocus?: boolean) => void) | null = null;

function viewBoxSize(svg: SVGSVGElement): {width: number; height: number} {
  const parts = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/);
  const width = Number(parts[2]);
  const height = Number(parts[3]);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 800,
    height: Number.isFinite(height) && height > 0 ? height : 400,
  };
}

// The copy lives in the same document as the original, so it gets fresh ids
// for the root and every marker, clip path, and gradient, with each reference
// (attributes and Mermaid's embedded stylesheet) pointed at the new names.
function cloneDiagram(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const withIds = [clone, ...clone.querySelectorAll("[id]")].filter((element) => element.id);
  const idMap = expandedIdMap(withIds.map((element) => element.id));
  for (const element of withIds) {
    element.id = idMap.get(element.id) ?? element.id;
  }
  for (const element of clone.querySelectorAll("*")) {
    for (const attribute of element.attributes) {
      if (attribute.value.includes("#")) {
        attribute.value = rewriteIdReferences(attribute.value, idMap);
      }
    }
  }
  for (const style of clone.querySelectorAll("style")) {
    style.textContent = rewriteIdReferences(style.textContent ?? "", idMap);
  }
  return clone;
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button, [tabindex]:not([tabindex='-1'])")].filter(
    (element) => !element.hasAttribute("disabled"),
  );
}

function openOverlay(svg: SVGSVGElement, trigger: HTMLButtonElement): void {
  closeActiveOverlay?.(false);
  const {width, height} = viewBoxSize(svg);
  let scale = 1;

  const overlay = document.createElement("div");
  overlay.className = "gg-diagram-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Expanded diagram");

  const toolbar = document.createElement("div");
  toolbar.className = "gg-diagram-toolbar";

  // The canvas takes focus so keyboard users can scroll it with the arrow keys.
  const viewport = document.createElement("div");
  viewport.className = "gg-diagram-viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute("aria-label", "Diagram canvas. Drag or scroll to move around; press plus or minus to zoom.");

  const stage = document.createElement("div");
  stage.className = "gg-diagram-stage";

  const clone = cloneDiagram(svg);
  clone.removeAttribute("width");
  clone.style.maxWidth = "none";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  const applyScale = () => {
    stage.style.width = `${width * scale}px`;
    stage.style.height = `${height * scale}px`;
    clone.style.transform = `scale(${scale})`;
    stage.dataset.scale = scale.toFixed(2);
  };

  const setScale = (next: number) => {
    scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, next));
    applyScale();
  };

  const close = (restoreFocus = true) => {
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
    document.body.classList.remove("gg-diagram-overlay-open");
    if (closeActiveOverlay === close) closeActiveOverlay = null;
    if (restoreFocus && trigger.isConnected) trigger.focus();
  };

  // aria-modal does not keep focus in by itself: Tab and Shift+Tab wrap
  // around the overlay's own controls instead of reaching the page behind.
  const keepFocusInside = (event: KeyboardEvent) => {
    const focusable = focusableIn(overlay);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !overlay.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      keepFocusInside(event);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setScale(scale * SCALE_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      setScale(scale / SCALE_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      setScale(1);
    }
  };

  const button = (label: string, title: string, onClick: () => void) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "gg-diagram-button";
    el.textContent = label;
    el.title = title;
    el.setAttribute("aria-label", title);
    el.addEventListener("click", onClick);
    return el;
  };

  toolbar.append(
    button("−", "Zoom out", () => setScale(scale / SCALE_STEP)),
    button("100%", "Reset zoom", () => setScale(1)),
    button("+", "Zoom in", () => setScale(scale * SCALE_STEP)),
    button("×", "Close", () => close()),
  );

  clone.style.transformOrigin = "top left";
  applyScale();
  stage.append(clone);
  viewport.append(stage);
  overlay.append(toolbar, viewport);

  // Mouse users drag the canvas to pan; touch and pens keep native scrolling.
  let drag: {x: number; y: number; left: number; top: number; moved: boolean} | null = null;
  let ignoreNextClick = false;
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = {x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false};
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    viewport.classList.add("is-panning");
    viewport.scrollLeft = drag.left - dx;
    viewport.scrollTop = drag.top - dy;
  });
  const endDrag = () => {
    if (drag?.moved) ignoreNextClick = true;
    drag = null;
    viewport.classList.remove("is-panning");
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  overlay.addEventListener("click", (event) => {
    // The click that ends a drag is not a request to close.
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }
    if (event.target === overlay || event.target === viewport) {
      close();
    }
  });
  // Plain wheel and two-finger swipes scroll the canvas; pinch (ctrl or cmd plus wheel) zooms.
  viewport.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setScale(event.deltaY < 0 ? scale * 1.1 : scale / 1.1);
    },
    {passive: false},
  );
  viewport.addEventListener("dblclick", () => setScale(scale === 1 ? 2 : 1));
  document.addEventListener("keydown", onKeydown, true);

  document.body.append(overlay);
  document.body.classList.add("gg-diagram-overlay-open");
  closeActiveOverlay = close;
  (toolbar.lastElementChild as HTMLButtonElement).focus();
}

// A theme switch re-renders the container's contents and drops the trigger,
// so the check is for the trigger itself rather than a one-time flag.
function decorate(container: Element): void {
  if (!(container instanceof HTMLElement) || container.querySelector(`:scope > .${TRIGGER_CLASS}`)) {
    return;
  }
  container.classList.add("gg-diagram-container");
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = TRIGGER_CLASS;
  trigger.textContent = "⛶ Expand";
  trigger.setAttribute("aria-label", "Expand diagram to full screen");
  trigger.addEventListener("click", () => {
    const svg = container.querySelector("svg");
    if (svg) {
      openOverlay(svg as SVGSVGElement, trigger);
    }
  });
  container.append(trigger);
}

function scan(root: ParentNode): void {
  if (root instanceof Element && root.matches(CONTAINER_SELECTOR)) {
    decorate(root);
  }
  for (const container of root.querySelectorAll(CONTAINER_SELECTOR)) {
    decorate(container);
  }
}

function start(): void {
  scan(document);
  observer?.disconnect();
  observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) {
          // New content inside an existing container (a theme re-render) needs
          // its trigger back, so check the container around the added node too.
          const container = node.closest(CONTAINER_SELECTOR);
          if (container) decorate(container);
          scan(node);
        }
      }
    }
  });
  observer.observe(document.body, {childList: true, subtree: true});
}

if (ExecutionEnvironment.canUseDOM) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once: true});
  } else {
    start();
  }
}

export function onRouteDidUpdate(): void {
  if (ExecutionEnvironment.canUseDOM) {
    // The overlay lives on document.body, outside the page that navigated away.
    closeActiveOverlay?.(false);
    scan(document);
  }
}
